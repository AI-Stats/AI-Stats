#!/usr/bin/env node

/**
 * Review and optionally merge provider/model parameter capabilities from the
 * external model registry's provider endpoint records.
 *
 * The endpoint records are intentionally used instead of model-level unions:
 * a model can expose a parameter through one upstream provider and not another.
 * The default mode is read-only. Use --write only after reviewing the report.
 */

import fs from "node:fs/promises";
import path from "node:path";

const DATA_ROOT = path.resolve("packages/data/catalog/src/data/api_providers");
const API_ROOT = "https://openrouter.ai/api/v1";
const DEFAULT_CONCURRENCY = 8;

const PROVIDER_ALIASES = {
	"anthropic-aws": ["amazonbedrock"],
	"anthropic-aws-us": ["amazonbedrock"],
	"anthropic-us": ["amazonbedrock"],
	"google-vertex": ["vertexai", "googlecloud"],
};

const PARAM_ALIASES = {
	max_completion_tokens: "max_tokens",
};

function normalize(value) {
	return String(value ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
}

function canonicalParam(value) {
	const normalized = String(value ?? "").trim();
	return PARAM_ALIASES[normalized] ?? normalized;
}

function parseArgs(argv) {
	const args = {
		write: false,
		provider: "",
		model: "",
		limit: 0,
		concurrency: DEFAULT_CONCURRENCY,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--write") args.write = true;
		else if (arg === "--provider") args.provider = String(argv[++index] ?? "");
		else if (arg === "--model") args.model = String(argv[++index] ?? "");
		else if (arg === "--limit") args.limit = Number(argv[++index]) || 0;
		else if (arg === "--concurrency") args.concurrency = Math.max(1, Number(argv[++index]) || DEFAULT_CONCURRENCY);
		else if (arg === "--help" || arg === "-h") {
			console.log([
				"Usage: node scripts/sync-provider-parameter-overlays.mjs [options]",
				"",
				"Default mode reports matching endpoint parameters without changing files.",
				"  --write                 Merge reported parameters into catalog files",
				"  --provider <id>         Limit to one catalog provider",
				"  --model <id>            Limit to one model id",
				"  --limit <n>             Limit the number of model endpoint lookups",
				"  --concurrency <n>       Maximum concurrent endpoint lookups",
			].join("\n"));
			process.exit(0);
		}
	}
	return args;
}

async function fetchJson(url) {
	const response = await fetch(url, {
		headers: { accept: "application/json" },
		signal: AbortSignal.timeout(20_000),
	});
	if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
	return response.json();
}

async function listProviderFiles() {
	const providerIds = (await fs.readdir(DATA_ROOT, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	return providerIds.map((providerId) => ({
		providerId,
		file: path.join(DATA_ROOT, providerId, "models.json"),
	}));
}

async function loadRows(file) {
	return JSON.parse(await fs.readFile(file, "utf8"));
}

function providerMatches(providerId, endpoint) {
	const normalizedProvider = normalize(providerId);
	const candidates = new Set([
		normalizedProvider,
		...(PROVIDER_ALIASES[providerId] ?? []).map(normalize),
	]);
	const endpointName = normalize(endpoint.provider_name);
	const endpointTag = normalize(endpoint.tag).replace(/(fp8|fp4|int8|int4)$/g, "");
	return candidates.has(endpointName) || candidates.has(endpointTag);
}

function endpointPath(modelId) {
	const encodedId = modelId.split("/").map((segment) => encodeURIComponent(segment)).join("/");
	return `${API_ROOT}/models/${encodedId}/endpoints`;
}

function endpointParameters(providerId, endpoints) {
	const matching = endpoints.filter((endpoint) =>
		epochIsHealthy(endpoint) && providerMatches(providerId, endpoint) && Array.isArray(endpoint.supported_parameters),
	);
	if (!matching.length) return null;

	// If a provider exposes multiple healthy deployments, use the intersection
	// so a parameter is not claimed unless every matching deployment accepts it.
	let result = new Set(matching[0].supported_parameters.map(canonicalParam));
	for (const endpoint of matching.slice(1)) {
		const current = new Set(endpoint.supported_parameters.map(canonicalParam));
		result = new Set([...result].filter((param) => current.has(param)));
	}
	return [...result];
}

function epochIsHealthy(endpoint) {
	return endpoint?.status === 0;
}

function paramId(entry) {
	if (typeof entry === "string") return canonicalParam(entry);
	if (entry && typeof entry === "object" && typeof entry.param_id === "string") {
		return canonicalParam(entry.param_id);
	}
	return "";
}

function mergeParams(existing, additions) {
	if (Array.isArray(existing)) {
		const merged = [...existing];
		const known = new Set(merged.map(paramId).filter(Boolean));
		for (const addition of additions) {
			if (!known.has(addition)) {
				merged.push(addition);
				known.add(addition);
			}
		}
		return merged;
	}
	if (existing && typeof existing === "object") {
		const merged = { ...existing };
		for (const addition of additions) {
			if (!(addition in merged)) merged[addition] = {};
		}
		return merged;
	}
	return additions;
}

async function mapWithConcurrency(items, concurrency, worker) {
	const output = [];
	let cursor = 0;
	async function run() {
		while (cursor < items.length) {
			const item = items[cursor++];
			output.push(await worker(item));
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
	return output;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const providerFilter = normalize(args.provider);
	const modelFilter = args.model.trim();
	const files = await listProviderFiles();
	const loaded = [];
	for (const entry of files) {
		const rows = await loadRows(entry.file);
		for (const row of rows) {
			if (!row.is_active_gateway) continue;
			if (providerFilter && normalize(entry.providerId) !== providerFilter) continue;
			if (modelFilter && row.api_model_id !== modelFilter && row.internal_model_id !== modelFilter) continue;
			loaded.push({ ...entry, row });
		}
	}

	const models = await fetchJson(`${API_ROOT}/models`);
	const availableModelIds = new Set((models.data ?? []).flatMap((model) => [model.id, model.canonical_slug].filter(Boolean)));
	const modelIds = [...new Set(loaded
		.map((entry) => entry.row.api_model_id || entry.row.internal_model_id)
		.filter((modelId) => availableModelIds.has(modelId)))];
	const lookupIds = args.limit > 0 ? modelIds.slice(0, args.limit) : modelIds;
	const endpointResults = await mapWithConcurrency(lookupIds, args.concurrency, async (modelId) => {
		try {
			const response = await fetchJson(endpointPath(modelId));
			return [modelId, response.data?.endpoints ?? []];
		} catch (error) {
			return [modelId, [], String(error?.message ?? error)];
		}
	});
	const endpointMap = new Map(endpointResults.map(([modelId, endpoints, error]) => [modelId, { endpoints, error }]));

	const updates = [];
	for (const entry of loaded) {
		const modelId = entry.row.api_model_id || entry.row.internal_model_id;
		const result = endpointMap.get(modelId);
		if (!result) continue;
		const params = endpointParameters(entry.providerId, result.endpoints);
		if (!params?.length) continue;
		const capability = entry.row.capabilities?.find((item) => item.capability_id === "text.generate");
		if (!capability) continue;
		const before = (Array.isArray(capability.params) ? capability.params : Object.keys(capability.params ?? {})).map(paramId).filter(Boolean);
		const after = mergeParams(capability.params, params);
		const afterIds = (Array.isArray(after) ? after : Object.keys(after)).map(paramId).filter(Boolean);
		const added = params.filter((param) => !before.includes(param));
		if (!added.length) continue;
		updates.push({
			provider: entry.providerId,
			file: entry.file,
			model: modelId,
			provider_model_slug: entry.row.provider_model_slug,
			added,
			params: afterIds,
			capability,
			mergedParams: after,
		});
		if (args.write) capability.params = after;
	}

	if (args.write) {
		const byFile = new Map();
		for (const update of updates) byFile.set(update.file, true);
		for (const file of byFile.keys()) {
			const rows = await loadRows(file);
			for (const entry of loaded.filter((item) => item.file === file)) {
				const update = updates.find((item) => item.file === file && item.model === (entry.row.api_model_id || entry.row.internal_model_id) && item.provider === entry.providerId);
				if (!update) continue;
				const row = rows.find((item) =>
					item.is_active_gateway === true &&
					item.provider_api_model_id === entry.row.provider_api_model_id &&
					item.provider_model_slug === entry.row.provider_model_slug,
				);
				const capability = row?.capabilities?.find((item) => item.capability_id === "text.generate");
				if (capability) capability.params = update.mergedParams;
			}
			await fs.writeFile(file, `${JSON.stringify(rows, null, 2)}\n`);
		}
	}

	const summary = {
		active_rows_considered: loaded.length,
		model_endpoint_lookups: lookupIds.length,
		updates: updates.length,
		files_changed: new Set(updates.map((update) => update.file)).size,
		write_mode: args.write,
		entries: updates.map(({ capability: _capability, mergedParams: _mergedParams, ...entry }) => entry),
	};
	console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
	console.error(error?.stack ?? error);
	process.exitCode = 1;
});
