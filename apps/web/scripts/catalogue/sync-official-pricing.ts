import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PRICING_TABLE_SOURCES } from "../../../api/src/pipeline/model-discovery/pricing-tables";
import {
	filesNamed,
	type JsonObject,
	mergeSimplePricing,
	normalized,
	pricingRule,
	readJson,
	safePricingRules,
	type PricingRuleOptions,
	writeJsonIfChanged as writeSharedJsonIfChanged,
} from "./catalogue-sync-shared";

export type OfficialPriceCandidate = {
	providerModel: string;
	capabilityId?: string;
	currency?: "USD" | "CNY";
	meters: Record<string, number>;
	ruleOptions?: Record<string, PricingRuleOptions>;
};

export type OfficialPricingComparison = {
	providerModel: string;
	apiModelId: string;
	capabilityId: string;
	meter: string;
	currency?: string;
	officialPrice: number;
	currentPrices: number[];
	status: "equal" | "different" | "missing" | "complex";
};

export type OfficialPricingProviderReport = {
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

export type OfficialPricingReport = {
	providers: OfficialPricingProviderReport[];
	rowsParsed: number;
	pricingCreated: number;
	pricingUpdated: number;
	unmatched: string[];
	ambiguous: string[];
	skippedComplex: string[];
	changedFiles: string[];
};

const DATA_ROOT = path.resolve(process.cwd(), "../../packages/data/catalog/src/data");
const PROVIDERS_ROOT = path.join(DATA_ROOT, "api_providers");
const PRICING_ROOT = path.join(DATA_ROOT, "pricing");

function requestedProviders(): string[] | null {
	const values = process.argv.flatMap((value) => {
		if (!value.startsWith("--provider=") && !value.startsWith("--providers=")) return [];
		return value.split("=", 2)[1]?.split(",") ?? [];
	});
	const providers = [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
	return providers.length > 0 ? providers : null;
}

const REQUESTED_PROVIDERS = requestedProviders();
const DRY_RUN = process.argv.includes("--dry-run");
const SUPPORTED_PROVIDERS = new Set([
	"anthropic",
	"cloudflare",
	"deepseek",
	"fireworks",
	"moonshotai",
	"openai",
	"perplexity",
	"stepfun",
	"together",
	"voyage",
	"weights-and-biases",
	"xiaomi",
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

function cny(value: string): number | null {
	const match = value.match(/(\d+(?:\.\d+)?)\s*(?:元|CNY|RMB)/i);
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

function weightsAndBiasesCandidates(tables: string[][][]): OfficialPriceCandidate[] {
	const headerIndex = tables.findIndex((table) => {
		const headers = table[0]?.map(normalized) ?? [];
		return headers.join("|") === "model|input tokens|output tokens|cache hit";
	});
	if (headerIndex < 0) return [];
	const body = tables.slice(headerIndex + 1).find((table) => table.some((row) => row.length === 4));
	if (!body) return [];
	return body.flatMap((row) => {
		const input = usd(row[1] ?? "");
		const output = usd(row[2] ?? "");
		const cache = usd(row[3] ?? "");
		if (!row[0] || input === null || output === null) return [];
		return [{
			providerModel: row[0].replace(/^(?:Z\.AI|Moonshot AI|NVIDIA|OpenAI|OpenPipe|Google|IBM|JetBrains|Meta|Microsoft)\s+/i, ""),
			meters: {
				input_text_tokens: input,
				output_text_tokens: output,
				...(cache === null ? {} : { cached_read_text_tokens: cache }),
			},
		}];
	});
}

function cloudflareCandidates(tables: string[][][]): OfficialPriceCandidate[] {
	const candidates: OfficialPriceCandidate[] = [];
	for (const table of tables) {
		const headers = table[0]?.map(normalized) ?? [];
		if (headers[0] !== "model" || !headers.some((header) => header.includes("price in tokens"))) continue;
		for (const row of table.slice(1)) {
			const providerModel = row[0]?.trim().replace(/^@cf\//i, "");
			const priceText = row[1] ?? "";
			if (!providerModel || !priceText) continue;
			const input = priceText.match(/\$\s*(\d+(?:\.\d+)?)\s+per\s+m\s+input\s+tokens/i);
			const cached = priceText.match(/\$\s*(\d+(?:\.\d+)?)\s+per\s+m\s+cached\s+input\s+tokens/i);
			const output = priceText.match(/\$\s*(\d+(?:\.\d+)?)\s+per\s+m\s+output\s+tokens/i);
			if (input) {
				candidates.push({
					providerModel,
					capabilityId: output ? "text.generate" : "text.embed",
					meters: {
						input_text_tokens: Number(input[1]),
						...(cached ? { cached_read_text_tokens: Number(cached[1]) } : {}),
						...(output ? { output_text_tokens: Number(output[1]) } : {}),
					},
				});
				continue;
			}
			const audio = priceText.match(/\$\s*(\d+(?:\.\d+)?)\s+per\s+audio\s+minute(?:\s+input)?/i);
			if (audio) {
				candidates.push({
					providerModel,
					capabilityId: "audio.transcribe",
					meters: { input_audio_minutes: Number(audio[1]) },
					ruleOptions: { input_audio_minutes: { unit: "minute", unitSize: 1 } },
				});
			}
		}
	}
	return candidates;
}

function stepfunCandidates(tables: string[][][]): OfficialPriceCandidate[] {
	const candidates: OfficialPriceCandidate[] = [];
	for (const table of tables) {
		const headers = table[0] ?? [];
		const modelIndex = headers.findIndex((header) => normalized(header) === "模型");
		const inputIndex = headers.findIndex((header) => header.includes("输入价格") && header.includes("缓存未命中"));
		const cacheIndex = headers.findIndex((header) => header.includes("输入价格") && header.includes("缓存命中") && !header.includes("未命中"));
		const outputIndex = headers.findIndex((header) => header.includes("输出价格"));
		if ([modelIndex, inputIndex, cacheIndex, outputIndex].some((index) => index < 0)) continue;
		for (const row of table.slice(1)) {
			const input = cny(row[inputIndex] ?? "");
			const cache = cny(row[cacheIndex] ?? "");
			const output = cny(row[outputIndex] ?? "");
			if (!row[modelIndex] || input === null || cache === null || output === null) continue;
			candidates.push({
				providerModel: row[modelIndex]!,
				currency: "CNY",
				meters: {
					input_text_tokens: input,
					cached_read_text_tokens: cache,
					output_text_tokens: output,
				},
			});
		}
	}
	return candidates;
}

function xiaomiCandidates(html: string): OfficialPriceCandidate[] {
	const text = cellText(html.replace(/<(script|style|svg|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " "));
	return Array.from(text.matchAll(/(?:Xiaomi\s+)?(MiMo-[A-Za-z0-9.-]+)(?:(?!MiMo-[A-Za-z0-9.-]+)[\s\S])*?Input \(cache hit\)\s*\$\s*(\d+(?:\.\d+)?)\s*\/\s*MTok(?:(?!MiMo-[A-Za-z0-9.-]+)[\s\S])*?Input \(cache miss\)\s*\$\s*(\d+(?:\.\d+)?)\s*\/\s*MTok(?:(?!MiMo-[A-Za-z0-9.-]+)[\s\S])*?Output\s*\$\s*(\d+(?:\.\d+)?)\s*\/\s*MTok/gi), (match) => ({
		providerModel: match[1]!,
		meters: {
			cached_read_text_tokens: Number(match[2]),
			input_text_tokens: Number(match[3]),
			output_text_tokens: Number(match[4]),
		},
	}));
}

export function extractOfficialPricing(providerId: string, html: string): OfficialPriceCandidate[] {
	if (providerId === "moonshotai") return moonshotCandidates(html);
	if (providerId === "xiaomi") return xiaomiCandidates(html);
	const tables = extractHtmlTableRows(html);
	if (providerId === "cloudflare") return cloudflareCandidates(tables);
	if (providerId === "deepseek") return deepseekCandidates(tables);
	if (providerId === "fireworks") return fireworksCandidates(tables);
	if (providerId === "stepfun") return stepfunCandidates(tables);
	if (providerId === "voyage") return voyageCandidates(tables);
	if (providerId === "weights-and-biases") return weightsAndBiasesCandidates(tables);
	return horizontalCandidates(tables);
}

async function writeJsonIfChanged(filePath: string, value: unknown, report: OfficialPricingProviderReport): Promise<boolean> {
	return writeSharedJsonIfChanged(filePath, value, report, { dataRoot: DATA_ROOT, dryRun: DRY_RUN });
}

function pricingFileSlug(value: string): string {
	return normalized(value).replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function safeOfficialPricingRules(
	pricing: JsonObject,
	meters: Record<string, number>,
	currency = "USD",
	ruleOptions: Record<string, PricingRuleOptions> = {},
): boolean {
	if (!safePricingRules(pricing)) return false;
	const officialMeters = new Set(Object.keys(meters));
	const relevantRules = (pricing.rules as JsonObject[])
		.filter((rule) => officialMeters.has(String(rule.meter)))
	if (currency !== "USD" && relevantRules.length !== officialMeters.size) return false;
	return relevantRules.every((rule) => rule.unit === (ruleOptions[String(rule.meter)]?.unit ?? "token")
			&& Number(rule.unit_size) === (ruleOptions[String(rule.meter)]?.unitSize ?? 1_000_000)
			&& rule.currency === currency
			&& Number.isFinite(Number(rule.price_per_unit))
			&& Number(rule.price_per_unit) >= 0);
}

async function writeReport(report: OfficialPricingReport): Promise<void> {
	const directory = path.join(process.cwd(), ".sync");
	await mkdir(directory, { recursive: true });
	await writeFile(path.join(directory, "official-pricing-sync.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function syncProvider(provider: string): Promise<OfficialPricingProviderReport> {
	const source = PRICING_TABLE_SOURCES.find((value) => value.providerId === provider);
	const report: OfficialPricingProviderReport = {
		provider,
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
		return report;
	}
	if (!SUPPORTED_PROVIDERS.has(provider)) {
		report.reason = "Official source is monitored for changes but does not yet have a structured parser";
		return report;
	}

	let response: Response;
	try {
		response = await fetch(source.sourceUrl, {
			headers: { "User-Agent": "Phaseo official pricing sync" },
			signal: AbortSignal.timeout(30_000),
		});
		if (!response.ok) throw new Error(`${source.providerName} pricing source returned HTTP ${response.status}`);
	} catch (error) {
		report.reason = error instanceof Error ? error.message : String(error);
		return report;
	}
	const extracted = extractOfficialPricing(provider, await response.text());
	report.rowsParsed = extracted.length;
	if (extracted.length === 0) throw new Error(`${source.providerName} official pricing parser returned zero rows`);

	const grouped = new Map<string, OfficialPriceCandidate[]>();
	for (const candidate of extracted) {
		const key = `${modelKey(candidate.providerModel)}:${candidate.capabilityId ?? "text.generate"}`;
		grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
	}
	const candidates = new Map<string, OfficialPriceCandidate>();
	for (const [key, values] of grouped) {
		const distinct = new Set(values.map((value) => JSON.stringify({ currency: value.currency ?? "USD", meters: value.meters })));
		if (distinct.size !== 1) {
			report.ambiguous.push(values[0]!.providerModel);
			continue;
		}
		candidates.set(key, values[0]!);
	}

	const mappings = await readJson<JsonObject[]>(path.join(PROVIDERS_ROOT, provider, "models.json")).catch((error) => {
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
		const pricingKey = `${provider}:${normalized(apiModelId)}:${capabilityId}`;
		const currency = candidate.currency ?? "USD";
		const existing = pricingByKey.get(pricingKey);
		if (existing) {
			const simple = safeOfficialPricingRules(existing.value, candidate.meters, currency, candidate.ruleOptions);
			for (const [meter, officialPrice] of Object.entries(candidate.meters)) {
				const currentPrices = (existing.value.rules as JsonObject[])
					.filter((rule) => rule.meter === meter && rule.currency === currency && rule.pricing_plan === "standard" && !rule.effective_to)
					.map((rule) => Number(rule.price_per_unit))
					.filter(Number.isFinite)
					.sort((left, right) => left - right);
				report.comparisons.push({
					providerModel: candidate.providerModel,
					apiModelId,
					capabilityId,
					meter,
					currency,
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
			const merged = mergeSimplePricing(existing.value, candidate.meters, candidate.ruleOptions);
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
				currency,
				officialPrice,
				currentPrices: [],
				status: "missing",
			});
		}

		const pricing: JsonObject = {
			key: `${provider}:${apiModelId}:${capabilityId}`,
			api_provider_id: provider,
			provider_slug: provider,
			api_model_id: apiModelId,
			capability_id: capabilityId,
			rules: Object.entries(candidate.meters).map(([meter, price]) => pricingRule(meter, price, currency, candidate.ruleOptions?.[meter])),
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
		const target = path.join(PRICING_ROOT, provider, pricingFileSlug(apiModelId), capabilityId, "pricing.json");
		if (await writeJsonIfChanged(target, pricing, report)) report.pricingCreated += 1;
	}

	report.unmatched = [...new Set(report.unmatched)].sort();
	report.ambiguous = [...new Set(report.ambiguous)].sort();
	report.skippedComplex = [...new Set(report.skippedComplex)].sort();
	report.comparisons.sort((left, right) => left.apiModelId.localeCompare(right.apiModelId)
		|| left.capabilityId.localeCompare(right.capabilityId) || left.meter.localeCompare(right.meter));
	report.changedFiles = [...new Set(report.changedFiles)].sort();
	return report;
}

async function main(): Promise<void> {
	const providers = REQUESTED_PROVIDERS ?? PRICING_TABLE_SOURCES.map((source) => source.providerId);
	const reports = await Promise.all(providers.map(async (provider) => {
		try {
			return await syncProvider(provider);
		} catch (error) {
			return {
				provider,
				sourceUrl: PRICING_TABLE_SOURCES.find((source) => source.providerId === provider)?.sourceUrl ?? null,
				rowsParsed: 0,
				pricingCreated: 0,
				pricingUpdated: 0,
				unmatched: [],
				ambiguous: [],
				skippedComplex: [],
				comparisons: [],
				changedFiles: [],
				reason: error instanceof Error ? error.message : String(error),
			} satisfies OfficialPricingProviderReport;
		}
	}));
	const report: OfficialPricingReport = {
		providers: reports,
		rowsParsed: reports.reduce((total, value) => total + value.rowsParsed, 0),
		pricingCreated: reports.reduce((total, value) => total + value.pricingCreated, 0),
		pricingUpdated: reports.reduce((total, value) => total + value.pricingUpdated, 0),
		unmatched: [...new Set(reports.flatMap((value) => value.unmatched))].sort(),
		ambiguous: [...new Set(reports.flatMap((value) => value.ambiguous))].sort(),
		skippedComplex: [...new Set(reports.flatMap((value) => value.skippedComplex))].sort(),
		changedFiles: [...new Set(reports.flatMap((value) => value.changedFiles))].sort(),
	};
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
