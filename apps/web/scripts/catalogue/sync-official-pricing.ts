import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PRICING_TABLE_SOURCES } from "../../../api/src/pipeline/model-discovery/pricing-tables";
import { mergeSimplePricing, safePricingRules } from "./sync-provider-discovery";

type JsonObject = Record<string, any>;

export type OfficialPriceCandidate = {
	providerModel: string;
	capabilityId?: string;
	meters: Record<string, number>;
};

type OfficialPricingComparison = {
	providerModel: string;
	apiModelId: string;
	capabilityId: string;
	meter: string;
	officialPrice: number;
	currentPrices: number[];
	status: "equal" | "different" | "missing" | "complex";
};

type OfficialPricingReport = {
	provider: string;
	sourceUrl: string | null;
	rowsParsed: number;
	pricingCreated: number;
	pricingUpdated: number;
	unmatched: string[];
	ambiguous: string[];
	skippedComplex: string[];
	comparisons: OfficialPricingComparison[];
	changedFiles: string[];
	reason?: string;
};

const DATA_ROOT = path.resolve(process.cwd(), "../../packages/data/catalog/src/data");
const PROVIDERS_ROOT = path.join(DATA_ROOT, "api_providers");
const PRICING_ROOT = path.join(DATA_ROOT, "pricing");
const PROVIDER = process.argv.find((value) => value.startsWith("--provider="))?.split("=", 2)[1]?.trim().toLowerCase();
const DRY_RUN = process.argv.includes("--dry-run");
const SUPPORTED_PROVIDERS = new Set([
	"anthropic",
	"deepseek",
	"fireworks",
	"moonshotai",
	"openai",
	"perplexity",
	"together",
	"voyage",
	"z-ai",
]);

function decodeHtml(value: string): string {
	return value
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&quot;/gi, '"')
		.replace(/&amp;/gi, "&");
}

function cellText(value: string): string {
	return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function extractHtmlTableRows(html: string): string[][][] {
	return Array.from(html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi), (table) =>
		Array.from(table[1]!.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi), (row) =>
			Array.from(row[1]!.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi), (cell) => cellText(cell[1]!)),
		).filter((row) => row.length > 0),
	).filter((table) => table.length > 0);
}

function normalized(value: unknown): string {
	return String(value ?? "").trim().toLowerCase();
}

function modelKey(value: unknown): string {
	return normalized(value)
		.replace(/\([^)]*\)/g, "")
		.replace(/^models\//, "")
		.replace(/[^a-z0-9]+/g, "");
}

function usd(value: string): number | null {
	const match = value.match(/\$\s*(\d+(?:\.\d+)?)/);
	if (!match) return null;
	const parsed = Number(match[1]);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function meterForHeader(header: string): string | null {
	const value = normalized(header);
	if (value.includes("storage")) return null;
	if (value.includes("5m cache") || value.includes("5-minute cache")) return "cached_write_text_tokens_5m";
	if (value.includes("1h cache") || value.includes("1-hour cache")) return "cached_write_text_tokens_1h";
	if (value.includes("cache hit") || value.includes("cached input")) return "cached_read_text_tokens";
	if (value.includes("output")) return "output_text_tokens";
	if (value.includes("input")) return "input_text_tokens";
	return null;
}

function horizontalCandidates(tables: string[][][]): OfficialPriceCandidate[] {
	const candidates: OfficialPriceCandidate[] = [];
	for (const table of tables) {
		const headerIndex = table.findIndex((row) => {
			const headers = row.map(normalized);
			return headers.some((value) => value === "model" || value.includes("model string"))
				&& headers.some((value) => value.includes("input"))
				&& headers.some((value) => value.includes("output"));
		});
		if (headerIndex < 0) continue;
		const headers = table[headerIndex]!;
		if (headers.some((header) => /short context|long context|training|batch/i.test(header))) continue;
		const modelIndex = headers.findIndex((header) => {
			const value = normalized(header);
			return value.includes("api model string") || value.includes("model string for api");
		});
		const fallbackModelIndex = headers.findIndex((header) => normalized(header) === "model" || normalized(header).startsWith("model "));
		const resolvedModelIndex = modelIndex >= 0 ? modelIndex : fallbackModelIndex;
		if (resolvedModelIndex < 0) continue;
		const meterColumns = headers.flatMap((header, index) => {
			const meter = meterForHeader(header);
			return meter ? [{ index, meter }] : [];
		});
		if (new Set(meterColumns.map((column) => column.meter)).size !== meterColumns.length) continue;
		for (const row of table.slice(headerIndex + 1)) {
			const providerModel = row[resolvedModelIndex]?.trim();
			if (!providerModel) continue;
			const meters = Object.fromEntries(meterColumns.flatMap(({ index, meter }) => {
				const price = usd(row[index] ?? "");
				return price === null ? [] : [[meter, price]];
			}));
			if (meters.input_text_tokens !== undefined && meters.output_text_tokens !== undefined) {
				candidates.push({ providerModel, meters });
			}
		}
	}
	return candidates;
}

function deepseekCandidates(tables: string[][][]): OfficialPriceCandidate[] {
	const candidates: OfficialPriceCandidate[] = [];
	for (const table of tables) {
		const modelRow = table.find((row) => normalized(row[0]) === "model" && row.length > 1);
		if (!modelRow) continue;
		const inputHit = table.find((row) => /input tokens.*cache hit/i.test(row[0] ?? ""));
		const inputMiss = table.find((row) => /input tokens.*cache miss/i.test(row[0] ?? ""));
		const output = table.find((row) => /output tokens/i.test(row[0] ?? ""));
		if (!inputMiss || !output) continue;
		for (let index = 1; index < modelRow.length; index += 1) {
			const input = usd(inputMiss[index] ?? "");
			const outputPrice = usd(output[index] ?? "");
			if (input === null || outputPrice === null) continue;
			const cache = inputHit ? usd(inputHit[index] ?? "") : null;
			candidates.push({
				providerModel: modelRow[index]!,
				meters: {
					input_text_tokens: input,
					...(cache === null ? {} : { cached_read_text_tokens: cache }),
					output_text_tokens: outputPrice,
				},
			});
		}
	}
	return candidates;
}

function moonshotCandidates(markdown: string): OfficialPriceCandidate[] {
	const rowsBlock = markdown.match(/rows=\{\[([\s\S]*?)\]\}/)?.[1] ?? "";
	return Array.from(rowsBlock.matchAll(/\[\s*"([^"]+)"[^\]]*?<>\s*\{["']\$["']\}(\d+(?:\.\d+)?)<\/\>[^\]]*?<>\s*\{["']\$["']\}(\d+(?:\.\d+)?)<\/\>[^\]]*?<>\s*\{["']\$["']\}(\d+(?:\.\d+)?)<\/\>/g), (match) => ({
		providerModel: match[1]!,
		meters: {
			cached_read_text_tokens: Number(match[2]),
			input_text_tokens: Number(match[3]),
			output_text_tokens: Number(match[4]),
		},
	}));
}

function fireworksCandidates(tables: string[][][]): OfficialPriceCandidate[] {
	const table = tables.find((value) => normalized(value[0]?.[0]) === "model" && normalized(value[0]?.[1]) === "standard");
	if (!table) return [];
	return table.slice(1).flatMap((row) => {
		const prices = Array.from((row[1] ?? "").matchAll(/\$\s*(\d+(?:\.\d+)?)/g), (match) => Number(match[1]));
		if (!row[0] || prices.length !== 3) return [];
		return [{
			providerModel: row[0],
			meters: {
				input_text_tokens: prices[0]!,
				cached_read_text_tokens: prices[1]!,
				output_text_tokens: prices[2]!,
			},
		}];
	});
}

function voyageCandidates(tables: string[][][]): OfficialPriceCandidate[] {
	const candidates: OfficialPriceCandidate[] = [];
	for (const table of tables) {
		const headers = table[0]?.map(normalized) ?? [];
		const priceIndex = headers.findIndex((header) => header === "price per million tokens");
		if (priceIndex < 0 || normalized(table[0]?.[0]) !== "model") continue;
		for (const row of table.slice(1)) {
			const price = usd(row[priceIndex] ?? "");
			if (price === null) continue;
			for (const providerModel of (row[0] ?? "").split(/\s+/).filter(Boolean)) {
				const rerank = providerModel.startsWith("rerank-");
				candidates.push({
					providerModel,
					capabilityId: rerank ? "text.rerank" : "text.embed",
					meters: { input_text_tokens: price },
				});
			}
		}
	}
	return candidates;
}

export function extractOfficialPricing(providerId: string, html: string): OfficialPriceCandidate[] {
	if (providerId === "moonshotai") return moonshotCandidates(html);
	const tables = extractHtmlTableRows(html);
	if (providerId === "deepseek") return deepseekCandidates(tables);
	if (providerId === "fireworks") return fireworksCandidates(tables);
	if (providerId === "voyage") return voyageCandidates(tables);
	return horizontalCandidates(tables);
}

async function filesNamed(root: string, fileName: string): Promise<string[]> {
	const output: string[] = [];
	async function visit(directory: string): Promise<void> {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) await visit(entryPath);
			else if (entry.name === fileName) output.push(entryPath);
		}
	}
	await visit(root);
	return output.sort();
}

async function readJson<T>(filePath: string): Promise<T> {
	return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writeJsonIfChanged(filePath: string, value: unknown, report: OfficialPricingReport): Promise<boolean> {
	const next = `${JSON.stringify(value, null, 2)}\n`;
	const current = await readFile(filePath, "utf8").catch(() => "");
	if (current === next) return false;
	report.changedFiles.push(path.relative(DATA_ROOT, filePath).replaceAll("\\", "/"));
	if (!DRY_RUN) {
		await mkdir(path.dirname(filePath), { recursive: true });
		await writeFile(filePath, next, "utf8");
	}
	return true;
}

function pricingRule(meter: string, price: number): JsonObject {
	return {
		meter,
		unit: "token",
		unit_size: 1_000_000,
		price_per_unit: price,
		currency: "USD",
		pricing_plan: "standard",
		note: null,
		match: [],
		priority: 100,
		region: null,
		cache_duration_seconds: null,
		conditions: [],
		source: null,
	};
}

function pricingFileSlug(value: string): string {
	return normalized(value).replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function safeOfficialPricingRules(pricing: JsonObject, meters: Record<string, number>): boolean {
	if (!safePricingRules(pricing)) return false;
	const officialMeters = new Set(Object.keys(meters));
	return (pricing.rules as JsonObject[])
		.filter((rule) => officialMeters.has(String(rule.meter)))
		.every((rule) => rule.unit === "token"
			&& Number(rule.unit_size) === 1_000_000
			&& rule.currency === "USD"
			&& Number.isFinite(Number(rule.price_per_unit))
			&& Number(rule.price_per_unit) >= 0);
}

async function writeReport(report: OfficialPricingReport): Promise<void> {
	const directory = path.join(process.cwd(), ".sync");
	await mkdir(directory, { recursive: true });
	await writeFile(path.join(directory, "official-pricing-sync.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
	if (!PROVIDER) throw new Error("--provider=<provider-id> is required");
	const source = PRICING_TABLE_SOURCES.find((value) => value.providerId === PROVIDER);
	const report: OfficialPricingReport = {
		provider: PROVIDER,
		sourceUrl: source?.sourceUrl ?? null,
		rowsParsed: 0,
		pricingCreated: 0,
		pricingUpdated: 0,
		unmatched: [],
		ambiguous: [],
		skippedComplex: [],
		comparisons: [],
		changedFiles: [],
	};
	if (!source) {
		report.reason = "No official pricing source is configured";
		await writeReport(report);
		console.log(JSON.stringify(report));
		return;
	}
	if (!SUPPORTED_PROVIDERS.has(PROVIDER)) {
		report.reason = "Official source is monitored for changes but does not yet have a structured parser";
		await writeReport(report);
		console.log(JSON.stringify(report));
		return;
	}

	const response = await fetch(source.sourceUrl, {
		headers: { "User-Agent": "Phaseo official pricing sync" },
		signal: AbortSignal.timeout(30_000),
	});
	if (!response.ok) throw new Error(`${source.providerName} pricing source returned HTTP ${response.status}`);
	const extracted = extractOfficialPricing(PROVIDER, await response.text());
	report.rowsParsed = extracted.length;
	if (extracted.length === 0) throw new Error(`${source.providerName} official pricing parser returned zero rows`);

	const grouped = new Map<string, OfficialPriceCandidate[]>();
	for (const candidate of extracted) {
		const key = `${modelKey(candidate.providerModel)}:${candidate.capabilityId ?? "text.generate"}`;
		grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
	}
	const candidates = new Map<string, OfficialPriceCandidate>();
	for (const [key, values] of grouped) {
		const distinct = new Set(values.map((value) => JSON.stringify(value.meters)));
		if (distinct.size !== 1) {
			report.ambiguous.push(values[0]!.providerModel);
			continue;
		}
		candidates.set(key, values[0]!);
	}

	const mappings = await readJson<JsonObject[]>(path.join(PROVIDERS_ROOT, PROVIDER, "models.json")).catch((error) => {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		return [];
	});
	const mappingByKey = new Map<string, JsonObject[]>();
	for (const mapping of mappings) {
		for (const value of [mapping.provider_model_slug, mapping.api_model_id, mapping.internal_model_id]) {
			const full = String(value ?? "");
			const tail = full.includes("/") ? full.split("/").slice(1).join("/") : full;
			const key = modelKey(tail);
			if (key) mappingByKey.set(key, [...(mappingByKey.get(key) ?? []), mapping]);
		}
	}

	const pricingByKey = new Map<string, { path: string; value: JsonObject }>();
	for (const filePath of await filesNamed(PRICING_ROOT, "pricing.json")) {
		const value = await readJson<JsonObject>(filePath);
		pricingByKey.set(`${normalized(value.api_provider_id)}:${normalized(value.api_model_id)}:${normalized(value.capability_id)}`, { path: filePath, value });
	}

	const checkedAt = new Date().toISOString();
	for (const candidate of candidates.values()) {
		const matches = [...new Map((mappingByKey.get(modelKey(candidate.providerModel)) ?? []).map((mapping) => [mapping.api_model_id, mapping])).values()];
		if (matches.length !== 1) {
			(matches.length === 0 ? report.unmatched : report.ambiguous).push(candidate.providerModel);
			continue;
		}
		const apiModelId = String(matches[0]!.api_model_id);
		const capabilityId = candidate.capabilityId ?? "text.generate";
		const supportsCapability = Array.isArray(matches[0]!.capabilities)
			&& matches[0]!.capabilities.some((capability: JsonObject) => capability?.capability_id === capabilityId);
		if (!supportsCapability) {
			report.skippedComplex.push(`${candidate.providerModel} is not mapped as ${capabilityId}`);
			continue;
		}
		const pricingKey = `${PROVIDER}:${normalized(apiModelId)}:${capabilityId}`;
		const existing = pricingByKey.get(pricingKey);
		if (existing) {
			const simple = safeOfficialPricingRules(existing.value, candidate.meters);
			for (const [meter, officialPrice] of Object.entries(candidate.meters)) {
				const currentPrices = (existing.value.rules as JsonObject[])
					.filter((rule) => rule.meter === meter && rule.pricing_plan === "standard" && !rule.effective_to)
					.map((rule) => Number(rule.price_per_unit))
					.filter(Number.isFinite)
					.sort((left, right) => left - right);
				report.comparisons.push({
					providerModel: candidate.providerModel,
					apiModelId,
					capabilityId,
					meter,
					officialPrice,
					currentPrices,
					status: !simple ? "complex" : currentPrices.length === 0 ? "missing"
						: currentPrices.length === 1 && currentPrices[0] === officialPrice ? "equal" : "different",
				});
			}
			if (!simple) {
				report.skippedComplex.push(candidate.providerModel);
				continue;
			}
			const merged = mergeSimplePricing(existing.value, candidate.meters);
			if (!merged.changed) continue;
			existing.value.verification = {
				status: "partial",
				checked_at: checkedAt,
				notes: `Pricing synchronized from the official provider source: ${source.sourceUrl}`,
			};
			if (await writeJsonIfChanged(existing.path, existing.value, report)) report.pricingUpdated += 1;
			continue;
		}
		for (const [meter, officialPrice] of Object.entries(candidate.meters)) {
			report.comparisons.push({
				providerModel: candidate.providerModel,
				apiModelId,
				capabilityId,
				meter,
				officialPrice,
				currentPrices: [],
				status: "missing",
			});
		}

		const pricing: JsonObject = {
			key: `${PROVIDER}:${apiModelId}:${capabilityId}`,
			api_provider_id: PROVIDER,
			provider_slug: PROVIDER,
			api_model_id: apiModelId,
			capability_id: capabilityId,
			rules: Object.entries(candidate.meters).map(([meter, price]) => pricingRule(meter, price)),
			regions: [],
			service_tiers: ["standard"],
			sources: [{
				kind: "official-pricing",
				url: source.sourceUrl,
				accessed_at: checkedAt,
				notes: "Parsed directly from the provider's official pricing documentation.",
			}],
			verification: {
				status: "partial",
				checked_at: checkedAt,
				notes: "Pricing synchronized from the official provider source for review.",
			},
		};
		const target = path.join(PRICING_ROOT, PROVIDER, pricingFileSlug(apiModelId), capabilityId, "pricing.json");
		if (await writeJsonIfChanged(target, pricing, report)) report.pricingCreated += 1;
	}

	report.unmatched = [...new Set(report.unmatched)].sort();
	report.ambiguous = [...new Set(report.ambiguous)].sort();
	report.skippedComplex = [...new Set(report.skippedComplex)].sort();
	report.comparisons.sort((left, right) => left.apiModelId.localeCompare(right.apiModelId)
		|| left.capabilityId.localeCompare(right.capabilityId) || left.meter.localeCompare(right.meter));
	report.changedFiles = [...new Set(report.changedFiles)].sort();
	await writeReport(report);
	console.log(JSON.stringify(report));
}

const direct = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (direct) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
