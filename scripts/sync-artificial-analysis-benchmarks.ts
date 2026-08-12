import * as dotenv from "dotenv";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createAdminClient } from "../apps/web/src/utils/supabase/admin";

dotenv.config({ path: resolve("apps/web/.env.local") });

const BENCHMARK_ID = "aa-intelligence-index-v4";
const API_URL = "https://artificialanalysis.ai/api/v2/language/models";
const LEGACY_API_URL = "https://artificialanalysis.ai/api/v2/data/llms/models";
const DATA_ROOT = resolve("packages/data/catalog/src/data");
const MODELS_ROOT = join(DATA_ROOT, "models");
const BENCHMARK_PATH = join(DATA_ROOT, "benchmarks", BENCHMARK_ID, "benchmark.json");

type ArtificialAnalysisModel = {
	slug: string;
	name: string;
	openrouter_api_id?: string | null;
	model_creator?: { name?: string | null } | null;
	evaluations?: {
		artificial_analysis_intelligence_index?: number | null;
	} | null;
};

type ArtificialAnalysisResponse = {
	tier: "free" | "pro" | "commercial";
	intelligence_index_version: number;
	pagination: {
		page: number;
		has_more: boolean;
	};
	data: ArtificialAnalysisModel[];
};

type ArtificialAnalysisLegacyResponse = {
	status: number;
	data: ArtificialAnalysisModel[];
};

type CatalogModel = {
	model_id: string;
	api_model_id?: string | null;
	organisation_id?: string | null;
	name?: string | null;
	benchmarks?: Array<Record<string, unknown>> | null;
};

type CatalogEntry = {
	file: string;
	model: CatalogModel;
};

function stableUuid(value: string) {
	const hash = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
	hash[12] = "4";
	hash[16] = ((Number.parseInt(hash[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
	const compact = hash.join("");
	return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

function normalized(value: string | null | undefined) {
	return String(value ?? "")
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^a-z0-9]+/g, "");
}

const VARIANT_SUFFIXES = new Set([
	"adaptive",
	"effort",
	"high",
	"low",
	"max",
	"medium",
	"minimal",
	"non",
	"reasoning",
	"thinking",
	"xhigh",
]);

function reorderClaudeSlug(candidate: string) {
	if (!candidate.startsWith("claude-")) return null;
	const remainder = candidate.slice("claude-".length);
	for (const family of ["opus", "sonnet", "haiku"] as const) {
		const marker = `-${family}`;
		const markerIndex = remainder.indexOf(marker);
		if (markerIndex <= 0) continue;
		const version = remainder.slice(0, markerIndex);
		const versionParts = version.split("-");
		if (!versionParts.every((part) => part.length > 0 && [...part].every((character) => character >= "0" && character <= "9"))) {
			continue;
		}
		const suffix = remainder.slice(markerIndex + marker.length);
		return `claude-${family}-${version}${suffix}`;
	}
	return null;
}

function slugCandidates(value: string | null | undefined) {
	const slug = String(value ?? "").toLowerCase();
	if (!slug) return [];
	const candidates = new Set([slug, normalized(slug)]);
	const parts = slug.split("-");
	while (parts.length > 1 && VARIANT_SUFFIXES.has(parts.at(-1) ?? "")) {
		parts.pop();
		candidates.add(parts.join("-"));
		candidates.add(normalized(parts.join("-")));
	}
	for (const candidate of [...candidates]) {
		const reordered = reorderClaudeSlug(candidate);
		if (reordered) {
			candidates.add(reordered);
			candidates.add(normalized(reordered));
		}
	}
	return [...candidates];
}

function nameCandidates(value: string | null | undefined) {
	const name = String(value ?? "").trim();
	if (!name) return [];
	return [...new Set([
		normalized(name),
		normalized(name.replace(/\s*\([^)]*\)\s*/g, " ")),
	])];
}

function collectModelFiles(directory: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...collectModelFiles(path));
		else if (entry.name === "model.json") files.push(path);
	}
	return files;
}

function addIndex(index: Map<string, CatalogEntry[]>, key: string, entry: CatalogEntry) {
	if (!key) return;
	const matches = index.get(key) ?? [];
	if (!matches.some((match) => match.file === entry.file)) matches.push(entry);
	index.set(key, matches);
}

function buildCatalogIndex(entries: CatalogEntry[]) {
	const exact = new Map<string, CatalogEntry[]>();
	const normalizedIds = new Map<string, CatalogEntry[]>();
	const names = new Map<string, CatalogEntry[]>();
	for (const entry of entries) {
		const ids = [entry.model.model_id, entry.model.api_model_id].filter(Boolean) as string[];
		for (const id of ids) {
			addIndex(exact, id.toLowerCase(), entry);
			addIndex(exact, id.split("/").pop()?.toLowerCase() ?? "", entry);
			addIndex(normalizedIds, normalized(id), entry);
			addIndex(normalizedIds, normalized(id.split("/").pop()), entry);
		}
		addIndex(names, normalized(entry.model.name), entry);
	}
	return { exact, normalizedIds, names };
}

function uniqueMatch(matches: CatalogEntry[] | undefined) {
	return matches?.length === 1 ? matches[0] : null;
}

function matchCatalogModel(
	model: ArtificialAnalysisModel,
	index: ReturnType<typeof buildCatalogIndex>,
) {
	for (const candidate of [model.openrouter_api_id, model.slug]) {
		const match = uniqueMatch(index.exact.get(String(candidate ?? "").toLowerCase()));
		if (match) return match;
		for (const normalizedCandidate of slugCandidates(candidate)) {
			const normalizedMatch = uniqueMatch(index.normalizedIds.get(normalized(normalizedCandidate)));
			if (normalizedMatch) return normalizedMatch;
		}
	}
	for (const candidate of nameCandidates(model.name)) {
		const match = uniqueMatch(index.names.get(candidate));
		if (match) return match;
	}
	return null;
}

async function fetchCurrentIndexVersion() {
	const response = await fetch("https://artificialanalysis.ai/models");
	if (!response.ok) return "4";
	const html = await response.text();
	return html.match(/Artificial Analysis Intelligence Index v(\d+(?:\.\d+)+)/)?.[1] ?? "4";
}

async function fetchLegacyArtificialAnalysisModels(apiKey: string) {
	const response = await fetch(LEGACY_API_URL, {
		headers: { "x-api-key": apiKey },
	});
	if (!response.ok) {
		throw new Error(`Artificial Analysis legacy API returned ${response.status}.`);
	}
	const body = (await response.json()) as ArtificialAnalysisLegacyResponse;
	return { models: body.data, version: await fetchCurrentIndexVersion() };
}

async function fetchArtificialAnalysisModels(apiKey: string) {
	const models: ArtificialAnalysisModel[] = [];
	let page = 1;
	let version: number | null = null;

	while (page <= 100) {
		const response = await fetch(`${API_URL}?page=${page}`, {
			headers: { "x-api-key": apiKey },
		});
		if (response.status === 403 && page === 1) {
			return fetchLegacyArtificialAnalysisModels(apiKey);
		}
		if (!response.ok) {
			throw new Error(`Artificial Analysis API returned ${response.status} on page ${page}.`);
		}
		const body = (await response.json()) as ArtificialAnalysisResponse;
		version ??= body.intelligence_index_version;
		models.push(...body.data);
		if (!body.pagination.has_more) break;
		page += 1;
	}

	if (version === null) throw new Error("Artificial Analysis did not return an index version.");
	return { models, version: String(version) };
}

async function syncDatabase(catalogEntries: CatalogEntry[]) {
	const supabase = createAdminClient();
	const benchmark = JSON.parse(readFileSync(BENCHMARK_PATH, "utf8")) as Record<string, unknown>;
	const timestamp = new Date().toISOString();
	const { error: benchmarkError } = await supabase.from("v2_benchmarks").upsert({
		benchmark_id: BENCHMARK_ID,
		name: benchmark.benchmark_name,
		category: benchmark.category ?? null,
		link: benchmark.link ?? null,
		total_models: benchmark.total_models ?? null,
		ascending_order: benchmark.ascending_order ?? false,
		benchmark_type: benchmark.type ?? null,
		updated_at: timestamp,
	}, { onConflict: "benchmark_id" });
	if (benchmarkError) throw benchmarkError;

	const rows = catalogEntries.flatMap((entry) => {
		const benchmarks = Array.isArray(entry.model.benchmarks) ? entry.model.benchmarks : [];
		const occurIdx = benchmarks.findIndex((result) => result.benchmark_id === BENCHMARK_ID);
		if (occurIdx < 0) return [];
		const result = benchmarks[occurIdx] as Record<string, unknown>;
		const resultKey = `${entry.model.model_id}:${BENCHMARK_ID}::${occurIdx}`;
		return [{
			result_id: stableUuid(`benchmark-result:${resultKey}`),
			model_slug: entry.model.model_id,
			benchmark_id: BENCHMARK_ID,
			score: String(result.score),
			score_numeric: Number(result.score),
			is_self_reported: false,
			other_info: result.other_info ?? null,
			source_link: result.source_link ?? null,
			rank: result.rank ?? null,
			occur_idx: occurIdx,
			variant: null,
			result_key: resultKey,
			updated_at: timestamp,
		}];
	});

	for (let offset = 0; offset < rows.length; offset += 200) {
		const { error } = await supabase
			.from("v2_benchmark_results")
			.upsert(rows.slice(offset, offset + 200), { onConflict: "result_id" });
		if (error) throw error;
	}

	const { data: existing, error: existingError } = await supabase
		.from("v2_benchmark_results")
		.select("result_id")
		.eq("benchmark_id", BENCHMARK_ID);
	if (existingError) throw existingError;
	const desiredIds = new Set(rows.map((row) => row.result_id));
	const staleIds = (existing ?? [])
		.map((row) => String(row.result_id))
		.filter((id) => !desiredIds.has(id));
	for (let offset = 0; offset < staleIds.length; offset += 200) {
		const { error } = await supabase
			.from("v2_benchmark_results")
			.delete()
			.in("result_id", staleIds.slice(offset, offset + 200));
		if (error) throw error;
	}
	console.log(`Synchronized ${rows.length} Intelligence Index results to Supabase and removed ${staleIds.length} stale results.`);
}

async function main() {
	const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY?.trim();
	if (!apiKey) {
		throw new Error("Set ARTIFICIAL_ANALYSIS_API_KEY to an Artificial Analysis API key.");
	}
	const write = process.argv.includes("--write");
	const catalogEntries = collectModelFiles(MODELS_ROOT).map((file) => ({
		file,
		model: JSON.parse(readFileSync(file, "utf8")) as CatalogModel,
	}));
	const index = buildCatalogIndex(catalogEntries);
	const source = await fetchArtificialAnalysisModels(apiKey);
	const scoredModels = source.models
		.map((model) => ({
			model,
			score: model.evaluations?.artificial_analysis_intelligence_index,
		}))
		.filter((entry): entry is { model: ArtificialAnalysisModel; score: number } =>
			typeof entry.score === "number" && Number.isFinite(entry.score),
		)
		.sort((left, right) => right.score - left.score);

	const matched = new Map<string, { source: ArtificialAnalysisModel; score: number; rank: number }>();
	const unmatched: ArtificialAnalysisModel[] = [];
	for (const [indexPosition, entry] of scoredModels.entries()) {
		const catalog = matchCatalogModel(entry.model, index);
		if (!catalog) {
			unmatched.push(entry.model);
			continue;
		}
		if (matched.has(catalog.file)) continue;
		matched.set(catalog.file, {
			source: entry.model,
			score: entry.score,
			rank: indexPosition + 1,
		});
	}

	console.log(
		`Artificial Analysis v${source.version}: ${scoredModels.length} scored models, ${matched.size} matched Phaseo models, ${unmatched.length} unmatched.`,
	);
	if (unmatched.length) {
		console.log(`Unmatched examples: ${unmatched.slice(0, 20).map((model) => model.name).join(", ")}`);
	}
	if (!write) {
		console.log("Dry run only. Re-run with --write after reviewing the match counts.");
		return;
	}

	for (const entry of catalogEntries) {
		const current = Array.isArray(entry.model.benchmarks) ? entry.model.benchmarks : [];
		const hadIntelligenceIndex = current.some(
			(benchmark) => benchmark.benchmark_id === BENCHMARK_ID,
		);
		const benchmarks = current.filter((benchmark) => benchmark.benchmark_id !== BENCHMARK_ID);
		const result = matched.get(entry.file);
		if (!result && !hadIntelligenceIndex) continue;
		if (result) {
			benchmarks.push({
				benchmark_id: BENCHMARK_ID,
				score: result.score,
				is_self_reported: false,
				other_info: `${result.source.name}; Artificial Analysis Intelligence Index v${source.version}`,
				source_link: `https://artificialanalysis.ai/models/${result.source.slug}`,
				rank: result.rank,
			});
		}
		entry.model.benchmarks = benchmarks;
		writeFileSync(entry.file, `${JSON.stringify(entry.model, null, 2)}\n`);
	}

	if (!existsSync(BENCHMARK_PATH)) throw new Error(`Missing benchmark metadata: ${BENCHMARK_PATH}`);
	const benchmark = JSON.parse(readFileSync(BENCHMARK_PATH, "utf8")) as Record<string, unknown>;
	benchmark.benchmark_name = `Artificial Analysis Intelligence Index v${source.version}`;
	benchmark.link = "https://artificialanalysis.ai/models";
	benchmark.total_models = scoredModels.length;
	writeFileSync(BENCHMARK_PATH, `${JSON.stringify(benchmark, null, 2)}\n`);
	console.log(`Updated ${matched.size} model files and ${BENCHMARK_PATH}.`);
	if (process.argv.includes("--sync-db")) await syncDatabase(catalogEntries);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
