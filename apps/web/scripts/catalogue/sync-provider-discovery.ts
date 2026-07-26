import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { normalizeProviderModelPricing } from "../../../api/src/pipeline/model-discovery/pricing-normalizers";
import {
	filesNamed,
	type JsonObject,
	mergeSimplePricing,
	normalized,
	pricingRule,
	readJson,
	safePricingRules,
	writeJsonIfChanged as writeSharedJsonIfChanged,
} from "./catalogue-sync-shared";

export { mergeSimplePricing, safePricingRules } from "./catalogue-sync-shared";

type DiscoveryRow = {
	provider_id: string;
	model_id: string;
	model_details: JsonObject;
	last_seen_at: string;
};

type SyncReport = {
	providers: number;
	rows: number;
	mappingsCreated: number;
	mappingsUpdated: number;
	pricingCreated: number;
	pricingUpdated: number;
	unmatched: string[];
	skippedPricing: string[];
	changedFiles: string[];
	officialPricing?: {
		provider: string;
		sourceUrl: string | null;
		rowsParsed: number;
		pricingCreated: number;
		pricingUpdated: number;
		unmatched: string[];
		ambiguous: string[];
		skippedComplex: string[];
		comparisons: Array<{
			providerModel: string;
			apiModelId: string;
			capabilityId: string;
			meter: string;
			currency?: string;
			officialPrice: number;
			currentPrices: number[];
			status: string;
		}>;
		reason?: string;
	};
};

const PROVIDER_ALIASES: Record<string, string> = {
	"aion-labs": "aion-labs",
	"amazon-bedrock": "amazon-bedrock",
	"arcee-ai": "arcee-ai",
	"atlascloud": "atlascloud",
	"gmicloud": "gmicloud",
	"moonshotai": "moonshotai",
	"moonshotai-turbo": "moonshotai-turbo",
	"novitaai": "novita",
};

const DATA_ROOT = path.resolve(process.cwd(), "../../packages/data/catalog/src/data");
const PROVIDERS_ROOT = path.join(DATA_ROOT, "api_providers");
const PRICING_ROOT = path.join(DATA_ROOT, "pricing");
const DRY_RUN = process.argv.includes("--dry-run");
const PROVIDER_FILTER = process.argv.find((value) => value.startsWith("--provider="))?.split("=", 2)[1]?.trim();

function fileSlug(value: string): string {
	return normalized(value).replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function asRecord(value: unknown): JsonObject | null {
	return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function positiveInteger(value: unknown): number | null {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function writeJsonIfChanged(filePath: string, value: unknown, report: SyncReport): Promise<boolean> {
	return writeSharedJsonIfChanged(filePath, value, report, { dataRoot: DATA_ROOT, dryRun: DRY_RUN });
}

function deepPositiveInteger(value: unknown, keys: string[], depth = 0): number | null {
	if (depth > 4) return null;
	const record = asRecord(value);
	if (!record) return null;
	for (const key of keys) {
		const found = positiveInteger(record[key]);
		if (found !== null) return found;
	}
	for (const nested of Object.values(record)) {
		const found = deepPositiveInteger(nested, keys, depth + 1);
		if (found !== null) return found;
	}
	return null;
}

export function extractDiscoveryLimits(details: unknown): { context: number | null; output: number | null } {
	return {
		context: deepPositiveInteger(details, ["context_length", "context_window", "max_context_length", "max_input_tokens"]),
		output: deepPositiveInteger(details, ["max_completion_tokens", "max_output_tokens", "output_token_limit"]),
	};
}

function primaryCapability(model: JsonObject): string {
	const capability = Array.isArray(model.capabilities)
		? model.capabilities.find((entry: JsonObject) => typeof entry?.capability_id === "string")?.capability_id
		: null;
	return capability || "text.generate";
}

function newProviderModel(providerId: string, canonicalModelId: string, row: DiscoveryRow): JsonObject {
	const limits = extractDiscoveryLimits(row.model_details);
	return {
		api_model_id: canonicalModelId,
		provider_api_model_id: `${providerId}:${canonicalModelId}`,
		provider_model_slug: row.model_id,
		internal_model_id: canonicalModelId,
		is_active_gateway: false,
		quantization_scheme: null,
		input_modalities: null,
		output_modalities: null,
		context_length: limits.context,
		max_output_tokens: limits.output,
		effective_from: null,
		effective_to: null,
		capabilities: [{
			capability_id: "text.generate",
			status: "active",
			params: [],
			reasoning: null,
			tool_call: null,
			structured_output: null,
			temperature: null,
			attachment: null,
			input_modalities: null,
			output_modalities: null,
			modes: [],
		}],
		routing_status: "active",
		routable: false,
		regions: { execution: ["global"], data: ["global"] },
		service_tiers: [],
		api: { formats: [], endpoint: null, deployment: null },
		sources: [],
		verification: {
			status: "partial",
			checked_at: row.last_seen_at,
			notes: "Discovered from the provider models API; routing remains disabled pending review.",
		},
		rate_limits: [],
	};
}

async function fetchDiscoveryRows(): Promise<DiscoveryRow[]> {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
	if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
	const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
	const output: DiscoveryRow[] = [];
	let from = 0;
	while (true) {
		let query = supabase
			.from("model_discovery_seen_models")
			.select("provider_id,model_id,model_details,last_seen_at")
			.order("provider_id", { ascending: true })
			.order("model_id", { ascending: true })
			.range(from, from + 999);
		if (PROVIDER_FILTER) query = query.eq("provider_id", PROVIDER_FILTER);
		const { data, error } = await query;
		if (error) throw new Error(error.message || "Failed to load model discovery state");
		const rows = (data ?? []) as DiscoveryRow[];
		output.push(...rows);
		if (rows.length < 1_000) break;
		from += 1_000;
	}
	return output;
}

async function loadCanonicalModelIndex(): Promise<{ ids: Set<string>; aliases: Map<string, string>; uniqueTails: Map<string, string> }> {
	const ids = new Set<string>();
	for (const filePath of await filesNamed(path.join(DATA_ROOT, "models"), "model.json")) {
		const model = await readJson<JsonObject>(filePath);
		if (model.model_id) ids.add(normalized(model.model_id));
	}
	const aliases = new Map<string, string>();
	for (const filePath of await filesNamed(path.join(DATA_ROOT, "aliases"), "alias.json")) {
		const alias = await readJson<JsonObject>(filePath);
		const target = normalized(alias.resolved_model_id ?? alias.resolved_api_model_id);
		if (alias.is_enabled !== false && ids.has(target)) aliases.set(normalized(alias.alias_slug), target);
	}
	const tails = new Map<string, string[]>();
	for (const id of ids) {
		const tail = id.split("/").slice(1).join("/");
		if (tail) tails.set(tail, [...(tails.get(tail) ?? []), id]);
	}
	const uniqueTails = new Map([...tails].filter(([, values]) => values.length === 1).map(([tail, values]) => [tail, values[0]!]));
	return { ids, aliases, uniqueTails };
}

function resolveCanonicalModelId(modelId: string, index: Awaited<ReturnType<typeof loadCanonicalModelIndex>>): string | null {
	const id = normalized(modelId).replace(/^models\//, "");
	if (index.ids.has(id)) return id;
	const alias = index.aliases.get(id);
	if (alias) return alias;
	return index.uniqueTails.get(id) ?? null;
}

async function main(): Promise<void> {
	const rows = await fetchDiscoveryRows();
	const canonical = await loadCanonicalModelIndex();
	const report: SyncReport = {
		providers: new Set(rows.map((row) => row.provider_id)).size,
		rows: rows.length,
		mappingsCreated: 0,
		mappingsUpdated: 0,
		pricingCreated: 0,
		pricingUpdated: 0,
		unmatched: [],
		skippedPricing: [],
		changedFiles: [],
	};
	const pricingFiles = await filesNamed(PRICING_ROOT, "pricing.json");
	const pricingByKey = new Map<string, { path: string; value: JsonObject }>();
	for (const filePath of pricingFiles) {
		const value = await readJson<JsonObject>(filePath);
		pricingByKey.set(`${normalized(value.api_provider_id)}:${normalized(value.api_model_id)}:${normalized(value.capability_id)}`, { path: filePath, value });
	}

	const rowsByProvider = new Map<string, DiscoveryRow[]>();
	for (const row of rows) rowsByProvider.set(row.provider_id, [...(rowsByProvider.get(row.provider_id) ?? []), row]);
	for (const [discoveryProviderId, providerRows] of rowsByProvider) {
		const providerId = PROVIDER_ALIASES[discoveryProviderId] ?? discoveryProviderId;
		const providerDirectory = path.join(PROVIDERS_ROOT, providerId);
		const providerPath = path.join(providerDirectory, "api_provider.json");
		const modelsPath = path.join(providerDirectory, "models.json");
		const provider = await readJson<JsonObject>(providerPath).catch(() => null);
		if (!provider) {
			report.unmatched.push(`${discoveryProviderId}: provider is not present in the canonical catalog`);
			continue;
		}
		const models = await readJson<JsonObject[]>(modelsPath).catch((): JsonObject[] => []);
		let mappingsChanged = false;

		for (const row of providerRows) {
			let mapping = models.find((model) => normalized(model.provider_model_slug) === normalized(row.model_id));
			if (!mapping) {
				const canonicalModelId = resolveCanonicalModelId(row.model_id, canonical);
				if (!canonicalModelId) {
					report.unmatched.push(`${discoveryProviderId}:${row.model_id}`);
					continue;
				}
				mapping = newProviderModel(providerId, canonicalModelId, row);
				models.push(mapping);
				report.mappingsCreated += 1;
				mappingsChanged = true;
			}

			const limits = extractDiscoveryLimits(row.model_details);
			if (mapping.context_length == null && limits.context !== null) {
				mapping.context_length = limits.context;
				mappingsChanged = true;
				report.mappingsUpdated += 1;
			}
			if (mapping.max_output_tokens == null && limits.output !== null) {
				mapping.max_output_tokens = limits.output;
				mappingsChanged = true;
				report.mappingsUpdated += 1;
			}

			const normalizedPricing = normalizeProviderModelPricing(discoveryProviderId, row.model_details);
			if (!normalizedPricing) continue;
			const capabilityId = primaryCapability(mapping);
			if (capabilityId !== "text.generate" && capabilityId !== "text.embed" && capabilityId !== "embeddings") continue;
			if (capabilityId === "text.generate" && normalizedPricing.meters.output_text_tokens === undefined) {
				report.skippedPricing.push(`${discoveryProviderId}:${row.model_id} has input-only pricing on a text generation mapping`);
				continue;
			}
			const apiModelId = String(mapping.api_model_id);
			const pricingKey = `${normalized(providerId)}:${normalized(apiModelId)}:${normalized(capabilityId)}`;
			const existing = pricingByKey.get(pricingKey);
			if (existing) {
				const merged = mergeSimplePricing(existing.value, normalizedPricing.meters);
				if (merged.changed) {
					existing.value.verification = {
						status: "partial",
						checked_at: row.last_seen_at,
						notes: "Pricing synchronized from the provider models API.",
					};
					await writeJsonIfChanged(existing.path, merged.value, report);
					report.pricingUpdated += 1;
				} else if (!safePricingRules(existing.value)) {
					report.skippedPricing.push(`${discoveryProviderId}:${row.model_id} uses conditional or tiered pricing`);
				}
			} else {
				const pricing: JsonObject = {
					key: `${providerId}:${apiModelId}:${capabilityId}`,
					api_provider_id: providerId,
					provider_slug: providerId,
					api_model_id: apiModelId,
					capability_id: capabilityId,
					rules: Object.entries(normalizedPricing.meters).map(([meter, price]) => pricingRule(meter, price)),
					regions: [],
					service_tiers: ["standard"],
					sources: [],
					verification: {
						status: "partial",
						checked_at: row.last_seen_at,
						notes: "Pricing synchronized from the provider models API.",
					},
				};
				const target = path.join(PRICING_ROOT, providerId, fileSlug(apiModelId), capabilityId, "pricing.json");
				await writeJsonIfChanged(target, pricing, report);
				pricingByKey.set(pricingKey, { path: target, value: pricing });
				report.pricingCreated += 1;
			}
		}

		if (mappingsChanged) {
			models.sort((left, right) => normalized(left.api_model_id).localeCompare(normalized(right.api_model_id)) || normalized(left.provider_model_slug).localeCompare(normalized(right.provider_model_slug)));
			await writeJsonIfChanged(modelsPath, models, report);
		}
	}

	report.unmatched = [...new Set(report.unmatched)].sort().slice(0, 500);
	report.skippedPricing = [...new Set(report.skippedPricing)].sort().slice(0, 500);
	report.changedFiles = [...new Set(report.changedFiles)].sort();
	await mkdir(path.join(process.cwd(), ".sync"), { recursive: true });
	const officialPricing = await readJson<SyncReport["officialPricing"]>(
		path.join(process.cwd(), ".sync", "official-pricing-sync.json"),
	).catch(() => undefined);
	report.officialPricing = officialPricing
		&& (!PROVIDER_FILTER || normalized(officialPricing.provider) === normalized(PROVIDER_FILTER))
		? officialPricing
		: undefined;
	const reportPath = path.join(process.cwd(), ".sync", "provider-catalog-sync.json");
	await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
	const markdown = renderSyncMarkdown(report);
	await writeFile(path.join(process.cwd(), ".sync", "provider-catalog-sync.md"), markdown, "utf8");
	console.log(JSON.stringify(report));
}

export function renderSyncMarkdown(report: SyncReport): string {
	return [
		"## Provider catalog synchronization",
		"",
		`- Providers checked: ${report.providers}`,
		`- Discovery records checked: ${report.rows}`,
		`- Model mappings created: ${report.mappingsCreated}`,
		`- Model mappings enriched: ${report.mappingsUpdated}`,
		`- Pricing files created: ${report.pricingCreated}`,
		`- Pricing files updated: ${report.pricingUpdated}`,
		`- Unmatched upstream models: ${report.unmatched.length}`,
		`- Complex pricing records left unchanged: ${report.skippedPricing.length}`,
		...(report.officialPricing ? [
			...(report.officialPricing.sourceUrl ? [`- Official pricing source: ${report.officialPricing.sourceUrl}`] : []),
			`- Official pricing rows parsed: ${report.officialPricing.rowsParsed}`,
			`- Official pricing files created: ${report.officialPricing.pricingCreated}`,
			`- Official pricing files updated: ${report.officialPricing.pricingUpdated}`,
			`- Official pricing rows requiring review: ${report.officialPricing.unmatched.length + report.officialPricing.ambiguous.length + report.officialPricing.skippedComplex.length}`,
			...(report.officialPricing.reason ? [`- Official pricing note: ${report.officialPricing.reason}`] : []),
		] : []),
		"",
		"The workflow applies official provider pricing sources and the persisted Cloudflare provider discovery snapshot. New mappings remain non-routable, conditional/tiered pricing is never overwritten, and removals are not automated.",
		"",
		...(report.unmatched.length > 0 ? ["<details><summary>Unmatched upstream models</summary>", "", ...report.unmatched.slice(0, 100).map((value) => `- \`${value}\``), "", "</details>", ""] : []),
		...(report.skippedPricing.length > 0 ? ["<details><summary>Pricing requiring manual review</summary>", "", ...report.skippedPricing.slice(0, 100).map((value) => `- ${value}`), "", "</details>", ""] : []),
		...(report.officialPricing?.comparisons?.some((comparison) => comparison.status !== "equal") ? [
			"<details><summary>Official pricing comparison</summary>",
			"",
			...report.officialPricing.comparisons
				.filter((comparison) => comparison.status !== "equal")
				.slice(0, 150)
				.map((comparison) => {
					const currency = comparison.currency ?? "USD";
					const format = (price: number) => currency === "USD" ? `$${price}/M` : `${currency} ${price}/M`;
					return `- \`${comparison.apiModelId}\` \`${comparison.capabilityId}\` \`${comparison.meter}\`: official **${format(comparison.officialPrice)}**, current **${comparison.currentPrices.length > 0 ? comparison.currentPrices.map(format).join(", ") : "missing"}** (${comparison.status})`;
				}),
			"",
			"</details>",
			"",
		] : []),
		"Created with Codex",
	].join("\n");
}

const direct = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (direct) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
