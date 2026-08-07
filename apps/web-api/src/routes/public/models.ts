import { Hono } from "hono";
import { getDataClient } from "@/data/supabase";
import type { Env } from "@/env";
import { buildModelsPageFacets, fetchModelsPageCatalogue } from "@/models/page-catalogue";
import { composeGatewayMetadata, fetchGatewayMetadataSource } from "@/models/gateway-metadata";
import { fetchModelPricingSources } from "@/models/pricing";
import { buildFreeRouterCatalogueRow, fetchFreeRouterOverview } from "@/models/free-router";
import { withPublicCache, type PublicCachePolicy } from "@/http/cache";

const CACHE_PROFILES = {
	catalogue: {
		edgeTtlSeconds: 5 * 60,
		staleWhileRevalidateSeconds: 5 * 60,
		cacheTags: ["web-api-models"],
	},
	overview: {
		edgeTtlSeconds: 24 * 60 * 60,
		staleWhileRevalidateSeconds: 7 * 24 * 60 * 60,
		cacheTags: ["web-api-model-details"],
	},
	benchmarks: {
		edgeTtlSeconds: 24 * 60 * 60,
		staleWhileRevalidateSeconds: 7 * 24 * 60 * 60,
		cacheTags: ["web-api-model-benchmarks"],
	},
	timeline: {
		edgeTtlSeconds: 24 * 60 * 60,
		staleWhileRevalidateSeconds: 7 * 24 * 60 * 60,
		cacheTags: ["web-api-model-timelines"],
	},
	subscriptions: {
		edgeTtlSeconds: 24 * 60 * 60,
		staleWhileRevalidateSeconds: 7 * 24 * 60 * 60,
		cacheTags: ["web-api-model-subscriptions"],
	},
	pricing: {
		edgeTtlSeconds: 60 * 60,
		staleWhileRevalidateSeconds: 24 * 60 * 60,
		cacheTags: ["web-api-model-pricing"],
	},
	performance: {
		edgeTtlSeconds: 15 * 60,
		staleWhileRevalidateSeconds: 15 * 60,
		cacheTags: ["web-api-model-performance"],
	},
	pricingHistory: {
		edgeTtlSeconds: 60 * 60,
		staleWhileRevalidateSeconds: 24 * 60 * 60,
		cacheTags: ["web-api-model-pricing-history"],
	},
	usageDaily: {
		edgeTtlSeconds: 15 * 60,
		staleWhileRevalidateSeconds: 15 * 60,
		cacheTags: ["web-api-model-usage-daily"],
	},
	catalogPricing: {
		edgeTtlSeconds: 60 * 60,
		staleWhileRevalidateSeconds: 24 * 60 * 60,
		cacheTags: ["web-api-catalog-pricing"],
	},
	freeRouter: {
		edgeTtlSeconds: 60 * 60,
		staleWhileRevalidateSeconds: 6 * 60 * 60,
		cacheTags: ["web-api-free-router-overview"],
	},
	realtime: {
		edgeTtlSeconds: 5 * 60,
		staleWhileRevalidateSeconds: 5 * 60,
		cacheTags: ["web-api-model-realtime"],
	},
	trajectory: {
		edgeTtlSeconds: 60 * 60,
		staleWhileRevalidateSeconds: 6 * 60 * 60,
		cacheTags: ["web-api-model-token-trajectories"],
	},
	routingHealth: {
		edgeTtlSeconds: 5 * 60,
		staleWhileRevalidateSeconds: 5 * 60,
		cacheTags: ["web-api-provider-routing-health"],
	},
	providerHealth: {
		edgeTtlSeconds: 5 * 60,
		staleWhileRevalidateSeconds: 5 * 60,
		cacheTags: ["web-api-model-provider-health"],
	},
	notice: {
		edgeTtlSeconds: 60 * 60,
		staleWhileRevalidateSeconds: 24 * 60 * 60,
		cacheTags: ["web-api-model-notices"],
	},
	apps: { edgeTtlSeconds: 15 * 60, staleWhileRevalidateSeconds: 60 * 60, cacheTags: ["web-api-model-apps"] },
} as const satisfies Record<string, PublicCachePolicy>;

function parseBoundedInt(value: string | null, fallback: number, maximum: number) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(0, Math.min(maximum, Math.floor(parsed)));
}

function parsePercentile(value: string | null, fallback = 50) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(1, Math.min(99, Math.round(parsed)));
}

function modelTag(modelId: string) {
	return `web-api-model-${encodeURIComponent(modelId).replace(/%/g, "")}`.slice(0, 128);
}

function toStringList(value: unknown): string[] {
	if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
	if (typeof value !== "string") return [];
	const trimmed = value.trim();
	if (!trimmed) return [];
	return (trimmed.startsWith("{") && trimmed.endsWith("}")
		? trimmed.slice(1, -1).split(",")
		: trimmed.split(/[\s,]+/))
		.map((item) => item.trim().replace(/^"|"$/g, ""))
		.filter(Boolean);
}

function normaliseGatewayStatus(value: unknown, isActive: unknown): string {
	const status = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
	if (status === "disabled" || status === "inactive" || status.startsWith("deranked")) return status;
	if (status && status !== "active") return status;
	return isActive ? "active" : "inactive";
}

function mergeStandardPricingAvailability(
	providers: Array<Record<string, unknown>>,
	standardProviders: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
	const standardByProviderId = new Map(
		standardProviders.flatMap((entry) => {
			const provider = entry.provider as Record<string, unknown> | null;
			const providerId = String(provider?.api_provider_id ?? "").trim();
			return providerId ? [[providerId, entry] as const] : [];
		}),
	);

	return providers.map((entry) => {
		const provider = entry.provider as Record<string, unknown> | null;
		const providerId = String(provider?.api_provider_id ?? "").trim();
		const standardEntry = standardByProviderId.get(providerId);
		if (!standardEntry) return entry;
		const standardProvider = standardEntry.provider as Record<string, unknown> | null;
		const standardModels = Array.isArray(standardEntry.provider_models)
			? standardEntry.provider_models as Array<Record<string, unknown>>
			: [];
		const standardModelByKey = new Map(standardModels.map((model) => [
			`${String(model.id ?? "")}::${String(model.endpoint ?? "")}`,
			model,
		]));
		const providerModels = Array.isArray(entry.provider_models)
			? (entry.provider_models as Array<Record<string, unknown>>).map((model) => {
				const standardModel = standardModelByKey.get(
					`${String(model.id ?? "")}::${String(model.endpoint ?? "")}`,
				);
				return standardModel ? {
					...model,
					is_active_gateway: standardModel.is_active_gateway,
					routing_status: standardModel.routing_status,
					capability_status: standardModel.capability_status,
				} : model;
			})
			: entry.provider_models;
		return {
			...entry,
			provider: standardProvider ? {
				...provider,
				status: standardProvider.status,
				routing_status: standardProvider.routing_status,
			} : provider,
			provider_models: providerModels,
		};
	});
}

function collectJsonTokens(value: unknown, tokens: string[] = []): string[] {
	if (Array.isArray(value)) {
		for (const item of value) collectJsonTokens(item, tokens);
	} else if (value && typeof value === "object") {
		for (const [key, item] of Object.entries(value)) {
			tokens.push(key);
			collectJsonTokens(item, tokens);
		}
	} else if (value !== null && value !== undefined) {
		tokens.push(String(value));
	}
	return tokens;
}

function gatewayFeatures(params: unknown): string[] {
	const features = new Set<string>();
	for (const token of collectJsonTokens(params)) {
		const value = token.toLowerCase().replace(/[\s-]+/g, "_");
		if (value.includes("reasoning") || value.includes("thinking")) features.add("reasoning");
		if (value.includes("tool") || value.includes("function_call")) features.add("tools");
		if (value.includes("structured_output") || value.includes("json_schema")) features.add("structured_outputs");
		if (value.includes("web_search") || value.includes("websearch")) features.add("web_search");
	}
	return [...features].sort();
}

function supportedParameters(params: unknown): string[] {
	if (!params || typeof params !== "object") return [];
	const source = params as Record<string, unknown>;
	const properties = source.properties;
	if (properties && typeof properties === "object" && !Array.isArray(properties)) {
		return Object.keys(properties as Record<string, unknown>).sort();
	}
	return Object.keys(source)
		.filter((key) => !["type", "title", "description", "default", "required", "properties"].includes(key))
		.sort();
}

function numberOrNull(value: unknown): number | null {
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

function median(values: number[]): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? (sorted[middle - 1] + sorted[middle]) / 2
		: sorted[middle];
}

function outputTokens(usage: unknown): number | null {
	if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;
	const record = usage as Record<string, unknown>;
	for (const key of [
		"output_tokens",
		"completion_tokens",
		"generated_tokens",
		"response_tokens",
		"outputTokens",
		"completionTokens",
		"total_tokens",
		"totalTokens",
	]) {
		const value = numberOrNull(record[key]);
		if (value != null && value > 0) return value;
	}
	return null;
}

const USAGE_INTEGER_FIELDS: Record<string, string> = {
	requests: "requests", success_requests: "successRequests", failed_requests: "failedRequests", neutral_requests: "neutralRequests", rate_limited_requests: "rateLimitedRequests", total_tokens: "totalTokens", input_tokens: "inputTokens", output_tokens: "outputTokens", reasoning_tokens: "reasoningTokens", input_text_tokens: "inputTextTokens", output_text_tokens: "outputTextTokens", input_image_tokens: "inputImageTokens", output_image_tokens: "outputImageTokens", input_audio_tokens: "inputAudioTokens", output_audio_tokens: "outputAudioTokens", input_video_tokens: "inputVideoTokens", output_video_tokens: "outputVideoTokens", image_inputs: "imageInputs", image_outputs: "imageOutputs", audio_inputs: "audioInputs", audio_outputs: "audioOutputs", video_inputs: "videoInputs", video_outputs: "videoOutputs", cached_read_tokens: "cachedReadTokens", cached_write_tokens: "cachedWriteTokens", cached_read_text_tokens: "cachedReadTextTokens", cached_write_text_tokens: "cachedWriteTextTokens", cached_write_text_tokens_5m: "cachedWriteTextTokens5m", cached_write_text_tokens_1h: "cachedWriteTextTokens1h", cached_read_image_tokens: "cachedReadImageTokens", cached_write_image_tokens: "cachedWriteImageTokens", cached_read_audio_tokens: "cachedReadAudioTokens", cached_write_audio_tokens: "cachedWriteAudioTokens", cached_read_video_tokens: "cachedReadVideoTokens", cached_write_video_tokens: "cachedWriteVideoTokens", input_quad_tokens: "inputQuadTokens", output_quad_tokens: "outputQuadTokens", total_quad_tokens: "totalQuadTokens", text_quad_tokens: "textQuadTokens", rerank_quad_tokens: "rerankQuadTokens", embedding_quad_tokens: "embeddingQuadTokens", moderation_quad_tokens: "moderationQuadTokens", ocr_quad_tokens: "ocrQuadTokens", input_characters: "inputCharacters", output_characters: "outputCharacters", total_characters: "totalCharacters", total_cost_nanos: "totalCostNanos",
};

function mapUsageDailyRow(row: Record<string, unknown>) {
	const mapped: Record<string, unknown> = { dayBucket: String(row.day_bucket ?? "").slice(0, 10), modelId: String(row.model_id ?? ""), providerId: String(row.provider_id ?? ""), endpoint: String(row.endpoint ?? "") };
	for (const [source, target] of Object.entries(USAGE_INTEGER_FIELDS)) mapped[target] = Math.max(0, Math.trunc(Number(row[source] ?? 0) || 0));
	for (const [source, target] of [["image_megapixels", "imageMegapixels"], ["audio_seconds", "audioSeconds"], ["video_pixel_seconds", "videoPixelSeconds"]] as const) mapped[target] = Number(row[source] ?? 0) || 0;
	for (const [source, target] of [["avg_latency_ms", "avgLatencyMs"], ["avg_generation_ms", "avgGenerationMs"], ["avg_throughput", "avgThroughput"]] as const) mapped[target] = numberOrNull(row[source]);
	return mapped;
}

async function modelAliases(env: Env, modelId: string): Promise<string[]> {
	const aliases = new Set([modelId]);
	const client = getDataClient(env);
	const [routeResult, aliasResult] = await Promise.all([
		client.from("v2_model_provider_routes").select("model_slug,provider_model_id,provider_model_slug").eq("model_slug", modelId),
		client.from("v2_model_aliases").select("alias_slug,model_slug").eq("model_slug", modelId).eq("enabled", true),
	]);
	for (const result of [routeResult, aliasResult]) {
		if (result.error) throw result.error;
	}
	for (const row of routeResult.data ?? []) for (const value of [row.model_slug, row.provider_model_id, row.provider_model_slug]) { const id = normalisedId(value); if (id) aliases.add(id); }
	for (const row of aliasResult.data ?? []) { const id = normalisedId(row.alias_slug); if (id) aliases.add(id); }
	return [...aliases];
}

function benchmarkType(value: unknown): "percentage" | "numerical" | null { const normalized = String(value ?? "").trim().toLowerCase(); return ["percentage", "percent", "pct", "%"].includes(normalized) ? "percentage" : ["numerical", "numeric", "number"].includes(normalized) ? "numerical" : null; }
function benchmarkScore(value: unknown, percentage: boolean): number | null { const match = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value.match(/[-+]?[0-9]*\.?[0-9]+/)?.[0] ?? "") : Number.NaN; if (!Number.isFinite(match)) return null; return percentage && Math.abs(match) > 0 && Math.abs(match) <= 1 ? match * 100 : match; }
function scoreDisplay(value: number | null, percentage: boolean, fallback: unknown): string { if (value == null) return fallback == null ? "-" : String(fallback); const formatted = value % 1 === 0 || Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2); return percentage ? `${formatted}%` : formatted; }
function benchmarkHighlights(results: Array<Record<string, unknown>>) {
	const selected = new Map<string, Record<string, unknown>>();
	for (const result of results) {
		const benchmark = (Array.isArray(result.benchmark) ? result.benchmark[0] : result.benchmark) as Record<string, unknown> | null; const id = String(result.benchmark_id ?? benchmark?.id ?? ""); if (!id) continue;
		const type = benchmarkType(benchmark?.type); const percentage = type ? type === "percentage" : typeof result.score === "string" && result.score.includes("%"); const score = benchmarkScore(result.score, percentage); const candidate = { ...result, _benchmark: benchmark ?? {}, _score: score, _percentage: percentage };
		const previous = selected.get(id); if (!previous) { selected.set(id, candidate); continue; }
		const rank = typeof result.rank === "number" ? result.rank : null; const previousRank = typeof previous.rank === "number" ? previous.rank : null;
		if (rank != null && (previousRank == null || rank < previousRank)) { selected.set(id, candidate); continue; } if (rank != null && previousRank != null && rank > previousRank) continue;
		const oldScore = typeof previous._score === "number" ? previous._score : null; if (score != null && (oldScore == null || (benchmark?.ascending_order === false ? score < oldScore : score > oldScore))) selected.set(id, candidate);
	}
	return Array.from(selected.entries()).map(([id, result]) => { const benchmark = result._benchmark as Record<string, unknown>; const score = typeof result._score === "number" ? result._score : null; const percentage = Boolean(result._percentage); return { benchmarkId: id, benchmarkName: String(benchmark.name ?? id), totalModels: typeof benchmark.total_models === "number" ? benchmark.total_models : null, rank: typeof result.rank === "number" ? result.rank : null, score, scoreDisplay: scoreDisplay(score, percentage, result.score), isPercentage: percentage, isSelfReported: Boolean(result.is_self_reported), otherInfo: typeof result.other_info === "string" ? result.other_info : null, sourceLink: typeof result.source_link === "string" ? result.source_link : null }; }).sort((a, b) => (b.totalModels ?? -1) - (a.totalModels ?? -1) || (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.benchmarkName.localeCompare(b.benchmarkName));
}

function normalisedId(value: unknown): string | null {
	const id = String(value ?? "").trim();
	return id.length > 0 ? id : null;
}

async function resolveNoticeApiModelId(env: Env, modelId: string): Promise<string | null> {
	const client = getDataClient(env);
	const [aliasResult, modelResult, routeIdResult, routeSlugResult] = await Promise.all([
		client.from("v2_model_aliases").select("model_slug").eq("alias_slug", modelId).eq("enabled", true).maybeSingle(),
		client.from("v2_models").select("model_slug").eq("model_slug", modelId).eq("hidden", false).maybeSingle(),
		client.from("v2_model_provider_routes").select("model_slug").eq("provider_model_id", modelId).limit(1),
		client.from("v2_model_provider_routes").select("model_slug").eq("provider_model_slug", modelId).limit(1),
	]);
	for (const result of [aliasResult, modelResult, routeIdResult, routeSlugResult]) {
		if (result.error) throw result.error;
	}
	return normalisedId(aliasResult.data?.model_slug)
		?? normalisedId(modelResult.data?.model_slug)
		?? normalisedId(routeIdResult.data?.[0]?.model_slug)
		?? normalisedId(routeSlugResult.data?.[0]?.model_slug)
		?? null;
}

type ModelsCatalogueVersion = "v1" | "v2";

async function fetchProviderExecutionRegions(env: Env, providerIds: string[]) {
	const regionsByProvider = new Map<string, string[]>();
	if (providerIds.length === 0) return regionsByProvider;
	const { data, error } = await getDataClient(env).rpc("get_v2_provider_region_map", {
		p_provider_slugs: providerIds,
	});
	if (error) throw error;
	for (const row of (data ?? []) as Record<string, unknown>[]) {
		const providerId = String(row.provider_slug ?? "").trim();
		if (!providerId) continue;
		const regions = toStringList(row.regions)
			.map((region) => region.toLowerCase())
			.filter(Boolean);
		regionsByProvider.set(providerId, [...new Set(regions)]);
	}
	return regionsByProvider;
}

async function fetchProviderStatuses(env: Env, providerIds: string[]) {
	const statusesByProvider = new Map<string, string>();
	if (providerIds.length === 0) return statusesByProvider;
	const { data, error } = await getDataClient(env)
		.from("v2_providers")
		.select("provider_slug,status")
		.in("provider_slug", providerIds);
	if (error) throw error;
	for (const row of data ?? []) {
		const providerId = String(row.provider_slug ?? "").trim();
		const status = String(row.status ?? "").trim().toLowerCase();
		if (providerId && status) statusesByProvider.set(providerId, status);
	}
	return statusesByProvider;
}

export async function fetchGatewayMonitorRows(
	env: Env,
	_catalogueVersion: ModelsCatalogueVersion = "v2",
): Promise<Map<string, Record<string, unknown>[]>> {
	const client = getDataClient(env);
	const rows: Record<string, unknown>[] = [];
	// The compatibility monitor RPC is already backed by the canonical V2
	// catalogue and emits the legacy page shape used by both API versions.
	const rpcName = "get_monitor_model_rows";
	for (let offset = 0; ; offset += 1000) {
		const { data, error } = await client
			.rpc(rpcName, { p_include_hidden: false })
			.range(offset, offset + 999);
		if (error) throw error;
		const page = (data ?? []) as Record<string, unknown>[];
		rows.push(...page.filter((row) => String(row.capability_status ?? "").toLowerCase() !== "internal_testing"));
		if (page.length < 1000) break;
	}
	const providerIds = Array.from(
		new Set(
			rows
				.map((row) => String(row.provider_id ?? "").trim())
				.filter(Boolean),
		),
	);
	const [providerRegionsById, providerStatusesById] = await Promise.all([
		fetchProviderExecutionRegions(env, providerIds),
		fetchProviderStatuses(env, providerIds),
	]);

	const byModelId = new Map<string, Record<string, unknown>[]>();
	for (const row of rows) {
		const baseModelId = String(row.model_id ?? row.api_model_id ?? "").trim();
		const isFreeVariant = Boolean(row.is_free_variant)
			|| String(row.api_model_id ?? "").trim().toLowerCase().endsWith(":free");
		const modelId = isFreeVariant && !baseModelId.toLowerCase().endsWith(":free")
			? `${baseModelId}:free`
			: baseModelId;
		const providerId = String(row.provider_id ?? "").trim();
		// The /models catalogue describes Phaseo availability. External catalogue
		// providers remain available on model detail pages, but must not inflate
		// this page's provider counts or hover lists.
		if (providerStatusesById.get(providerId) === "external") continue;
		const apiModelId = String(row.api_model_id ?? "").trim();
		const providerModelId = String(
			row.provider_api_model_id ?? row.provider_model_slug ?? apiModelId,
		).trim();
		const capabilityId = String(row.capability_id ?? "").trim();
		if (!modelId || !providerId || !apiModelId || !providerModelId || !capabilityId) continue;
		const params = row.capability_params;
		const monitorRow = {
			id: `${modelId}::${providerId}::${providerModelId}::${capabilityId}`,
			model: (() => {
				const name = String(row.model_name ?? modelId).trim() || modelId;
				if (!isFreeVariant || /\(\s*free\s*\)$/i.test(name)) return name;
				return `${name} (Free)`;
			})(),
			modelId,
			apiModelId,
			organisationId: row.organisation_id ?? undefined,
			organisationName: row.organisation_name ?? undefined,
			provider: {
				name: String(row.api_provider_name ?? providerId).trim() || providerId,
				id: providerId,
				inputPrice: numberOrNull(row.input_price) ?? 0,
				outputPrice: numberOrNull(row.output_price) ?? 0,
				standardInputPrice: numberOrNull(row.standard_input_price),
				standardOutputPrice: numberOrNull(row.standard_output_price),
				standardInputPriceLabel: row.standard_input_price_label ?? null,
				standardInputPriceUnit: row.standard_input_price_unit ?? null,
				standardOutputPriceLabel: row.standard_output_price_label ?? null,
				standardOutputPriceUnit: row.standard_output_price_unit ?? null,
				fromPrice: numberOrNull(row.from_price),
				fromPriceUnit: row.from_price_unit ?? null,
				pricingDetailRows: [],
				features: gatewayFeatures(params),
				executionRegions: providerRegionsById.get(providerId) ?? [],
			},
			endpoint: capabilityId,
			gatewayStatus: normaliseGatewayStatus(row.capability_status, row.is_active_gateway),
			inputModalities: toStringList(row.input_modalities).length ? toStringList(row.input_modalities) : toStringList(row.model_input_types),
			outputModalities: toStringList(row.output_modalities).length ? toStringList(row.output_modalities) : toStringList(row.model_output_types),
			context: numberOrNull(row.context_length) ?? numberOrNull(row.capability_max_input_tokens) ?? 0,
			maxOutput: numberOrNull(row.provider_max_output_tokens) ?? numberOrNull(row.capability_max_output_tokens) ?? 0,
			quantization: row.quantization_scheme ?? undefined,
			supportedParameters: supportedParameters(params),
			effectiveFrom: row.effective_from ?? undefined,
			tier: row.is_free_variant ? "free" : String(row.pricing_tier ?? "standard"),
			added: row.model_release_date ?? undefined,
			retired: row.model_retirement_date ?? undefined,
			weeklyTokensModel: numberOrNull(row.weekly_tokens_model),
			weeklyTokensModelProvider: numberOrNull(row.weekly_tokens_model_provider),
			weeklyThroughputModel: numberOrNull(row.weekly_throughput_model),
			weeklyLatencyModel: numberOrNull(row.weekly_latency_model),
		};
		byModelId.set(modelId, [...(byModelId.get(modelId) ?? []), monitorRow]);
	}
	return byModelId;
}

function normaliseRankingKey(value: unknown): string {
	return String(value ?? "").trim().toLowerCase();
}

function buildModelsTablePayload(
	rowsByModelId: Map<string, Record<string, unknown>[]>,
) {
	const rows = [...rowsByModelId.values()].flat();
	const tokensByModel = new Map<string, number>();
	const tokensByModelProvider = new Map<string, number>();
	const endpoints = new Set<string>();
	const modalities = new Set<string>();
	const features = new Set<string>();
	const statuses = new Set<string>();

	for (const row of rows) {
		const modelKey = normaliseRankingKey(row.modelId);
		const provider = row.provider as Record<string, unknown> | undefined;
		const providerKey = normaliseRankingKey(provider?.id);
		const modelTokens = Number(row.weeklyTokensModel ?? 0);
		const providerTokens = Number(row.weeklyTokensModelProvider ?? 0);
		if (modelKey && modelKey !== "unknown" && modelKey !== "other") {
			if (Number.isFinite(modelTokens) && modelTokens >= 0) {
				tokensByModel.set(
					modelKey,
					Math.max(tokensByModel.get(modelKey) ?? 0, modelTokens),
				);
			}
			if (providerKey && Number.isFinite(providerTokens) && providerTokens >= 0) {
				const compositeKey = `${modelKey}::${providerKey}`;
				tokensByModelProvider.set(
					compositeKey,
					Math.max(tokensByModelProvider.get(compositeKey) ?? 0, providerTokens),
				);
			}
		}

		const endpoint = String(row.endpoint ?? "").trim();
		if (endpoint) endpoints.add(endpoint);
		for (const modality of [
			...toStringList(row.inputModalities),
			...toStringList(row.outputModalities),
		]) {
			modalities.add(modality);
		}
		for (const feature of toStringList(provider?.features)) features.add(feature);
		const status = String(row.gatewayStatus ?? "").trim();
		if (status) statuses.add(status);
	}

	const models = rows.map((row) => {
		const provider = (row.provider ?? {}) as Record<string, unknown>;
		const providerKey = normaliseRankingKey(provider.id);
		const modelKeys = [row.modelId, row.apiModelId]
			.map(normaliseRankingKey)
			.filter(Boolean);
		let popularityTokensWeek = 0;
		for (const modelKey of modelKeys) {
			const providerTokens = providerKey
				? tokensByModelProvider.get(`${modelKey}::${providerKey}`)
				: undefined;
			if (providerTokens !== undefined) {
				popularityTokensWeek = providerTokens;
				break;
			}
			popularityTokensWeek = Math.max(
				popularityTokensWeek,
				tokensByModel.get(modelKey) ?? 0,
			);
		}

		return {
			id: row.id,
			model: row.model,
			modelId: row.modelId,
			organisationId: row.organisationId,
			organisationName: row.organisationName,
			provider: {
				name: provider.name,
				id: provider.id,
				inputPrice: provider.inputPrice,
				outputPrice: provider.outputPrice,
				features: provider.features,
				executionRegions: provider.executionRegions,
			},
			endpoint: row.endpoint,
			gatewayStatus: row.gatewayStatus,
			inputModalities: row.inputModalities,
			outputModalities: row.outputModalities,
			context: row.context,
			maxOutput: row.maxOutput,
			quantization: row.quantization,
			supportedParameters: row.supportedParameters,
			tier: row.tier,
			added: row.added,
			retired: row.retired,
			popularityTokensWeek,
		};
	});

	return {
		models,
		facets: {
			endpoints: [...endpoints].sort(),
			modalities: [...modalities].sort(),
			features: [...features].sort(),
			statuses: [...statuses].sort(),
		},
	};
}

const CATALOGUE_CACHE_SCHEMA_VERSION = "3";

function catalogueCacheRequest(request: Request): Request {
	const url = new URL(request.url);
	url.searchParams.set("_phaseo_cache_schema", CATALOGUE_CACHE_SCHEMA_VERSION);
	return new Request(url, request);
}

async function matchCachedCatalogue(request: Request): Promise<Response | null> {
	if (typeof caches === "undefined") return null;
	try {
		const response = await (caches as unknown as { default: Cache }).default.match(catalogueCacheRequest(request));
		if (!response) return null;
		const headers = new Headers(response.headers);
		headers.set("X-Phaseo-Local-Cache", "HIT");
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	} catch {
		return null;
	}
}

async function storeCatalogueInCache(request: Request, response: Response): Promise<void> {
	if (typeof caches === "undefined") return;
	try {
		await (caches as unknown as { default: Cache }).default.put(catalogueCacheRequest(request), response.clone());
	} catch {
		// Cloudflare's CDN headers remain the shared-cache fallback if a local
		// Cache API write is unavailable or rejected.
	}
}

function sectionPolicy(section: keyof typeof CACHE_PROFILES, modelId?: string): PublicCachePolicy {
	const profile = CACHE_PROFILES[section];
	return {
		...profile,
		cacheTags: modelId ? [...profile.cacheTags, modelTag(modelId)] : profile.cacheTags,
	};
}

function cataloguePolicy(catalogueVersion: ModelsCatalogueVersion, includeVirtual = false): PublicCachePolicy {
	const policy = sectionPolicy("catalogue");
	const versionPolicy = catalogueVersion === "v2"
		? { ...policy, cacheTags: [...(policy.cacheTags ?? []), "web-api-models-v2"] }
		: policy;
	return includeVirtual
		? { ...versionPolicy, cacheTags: [...(versionPolicy.cacheTags ?? []), "web-api-free-router-overview"] }
		: versionPolicy;
}

function notFound(c: { json: (value: unknown, status: number) => Response }) {
	return c.json({ error: "model_not_found" }, 404);
}

function v2ModelStatus(value: unknown): string {
	const status = String(value ?? "").trim().toLowerCase().replace(/[\\s-]+/g, "_");
	if (status === "active" || status === "available") return "Available";
	if (status === "rumoured") return "Rumoured";
	if (status === "draft" || status === "announced") return "Announced";
	if (status === "preview") return "Preview";
	if (status === "limited_access") return "Limited Access";
	if (status === "deprecated") return "Deprecated";
	if (status === "retired") return "Retired";
	if (status === "unknown") return "Unknown";
	return "Withheld";
}

type ModelVariantSummary = {
	model_id: string;
	name: string;
	variant_kind: string;
};

async function fetchModelVariants(
	env: Env,
	modelId: string,
): Promise<ModelVariantSummary[]> {
	const currentModelId = modelId.trim();
	if (!currentModelId) return [];
	const result = await getDataClient(env).rpc("get_v2_model_variants", {
		p_model_slug: currentModelId,
	});
	if (result.error) throw result.error;

	return (result.data ?? [])
		.map((model) => ({
			model_id: String(model.model_id),
			name: String(model.name),
			variant_kind: String(model.variant_kind ?? "standard"),
		}));
}

function v2ModelPageShape(
	row: Record<string, unknown>,
	aliases: string[],
	identity: Record<string, unknown> = {},
	variants: ModelVariantSummary[] = [],
) {
	const inputTypes = Array.isArray(row.gateway_input_modalities) ? row.gateway_input_modalities : [];
	const outputTypes = Array.isArray(row.gateway_output_modalities) ? row.gateway_output_modalities : [];
	const contextLengths = Array.isArray(row.context_lengths) ? row.context_lengths : [];
	const modelDetails = contextLengths.length > 0
		? [{ detail_name: "input_context_length", detail_value: contextLengths[contextLengths.length - 1] }]
		: [];
	if (identity.license ?? row.license) modelDetails.push({ detail_name: "license", detail_value: identity.license ?? row.license });
	return {
		model_id: identity.model_slug ?? row.model_id,
		name: identity.name ?? row.name,
		variant_kind: identity.variant_kind ?? row.variant_kind ?? "standard",
		base_model_id: identity.base_model_slug ?? row.base_model_slug ?? null,
		organisation_id: identity.lab_slug ?? row.organisation_id,
		description: row.description ?? null,
		status: v2ModelStatus(identity.catalogue_status ?? identity.status ?? row.gateway_status),
		previous_model_id: identity.previous_model_slug ?? null,
		announcement_date: identity.announced_at ?? null,
		release_date: identity.released_at ?? row.primary_date ?? null,
		deprecation_date: identity.deprecated_at ?? null,
		retirement_date: identity.retired_at ?? null,
		license: identity.license ?? row.license ?? null,
		license_url: identity.license_url ?? row.license_url ?? null,
		input_types: inputTypes.join(","),
		output_types: outputTypes.join(","),
		family_id: identity.family_slug ?? null,
		updated_at: identity.updated_at ?? null,
		organisation: { name: identity.lab_name ?? row.organisation_name ?? row.organisation_id, country_code: identity.lab_country_code ?? "" },
		model_links: [],
		model_family: null,
		model_details: modelDetails,
		aliases,
		variants,
	};
}

export const publicModelsRouter = new Hono<{ Bindings: Env }>();

/** Main models API. Deliberately excludes volatile benchmark/performance data. */
publicModelsRouter.get("/", async (c) => {
	const cached = await matchCachedCatalogue(c.req.raw);
	if (cached) return cached;
	try {
		const requestedVersion = c.req.query("catalogue_version")?.trim().toLowerCase();
		if (requestedVersion && requestedVersion !== "v1" && requestedVersion !== "v2") {
			return c.json({ error: "invalid_catalogue_version" }, 400);
		}
		const catalogueVersion: ModelsCatalogueVersion = "v2";
		const shape = c.req.query("shape");
		const limit = Math.max(
			1,
			parseBoundedInt(c.req.query("limit"), 100, shape === "table" ? 10_000 : 2_000),
		);
		const offset = parseBoundedInt(
			c.req.query("offset"),
			0,
			shape === "table" ? Number.MAX_SAFE_INTEGER : 10_000,
		);
		const search = c.req.query("search")?.trim();
		const region = c.req.query("region")?.trim().toLowerCase() || null;
		const serviceTier = c.req.query("service_tier")?.trim().toLowerCase() || null;
		if (shape === "page") {
			const projection = parseBoundedInt(c.req.query("projection"), 4, 100);
			const includeVirtual = projection >= 5;
			// The compact page RPC is backed by the canonical V2 tables and emits
			// the stable card contract used by both catalogue versions.
			const [catalogue, freeRouter] = await Promise.all([
				fetchModelsPageCatalogue(c.env, { region, serviceTier }, catalogueVersion),
				includeVirtual ? fetchFreeRouterOverview(c.env) : Promise.resolve(null),
			]);
			const databaseModels = catalogue.models.filter((model) => model.model_id !== "phaseo/free");
			const allModels = freeRouter ? [buildFreeRouterCatalogueRow(freeRouter), ...databaseModels] : databaseModels;
			const normalizedSearch = search?.toLowerCase();
			const filtered = normalizedSearch ? allModels.filter((model) => String(model.name ?? "").toLowerCase().includes(normalizedSearch)) : allModels;
			const response = withPublicCache(c.json({ models: filtered.slice(offset, offset + limit), facets: buildModelsPageFacets(filtered), pricing_complete: catalogue.pricingComplete, total: filtered.length, limit, offset, catalogue_version: catalogueVersion, shape: "page", projection }), cataloguePolicy(catalogueVersion, includeVirtual));
			await storeCatalogueInCache(c.req.raw, response);
			return response;
		}
		if (shape === "table") {
			const projection = parseBoundedInt(c.req.query("projection"), 2, 100);
			const payload = buildModelsTablePayload(
				await fetchGatewayMonitorRows(c.env, catalogueVersion),
			);
			const models = payload.models.slice(offset, offset + limit);
			const response = withPublicCache(
				c.json({
					models,
					facets: payload.facets,
					total: payload.models.length,
					limit,
					offset,
					catalogue_version: catalogueVersion,
					shape: "table",
					projection,
				}),
				cataloguePolicy(catalogueVersion),
			);
			await storeCatalogueInCache(c.req.raw, response);
			return response;
		}
		const gatewayRowsByModelId = await fetchGatewayMonitorRows(
			c.env,
			catalogueVersion,
		);
		const table = "v2_models";
		const select = "model_slug,lab_slug,name,description,status,released_at,announced_at,updated_at,input_modalities,output_modalities,organisation:v2_labs!v2_models_lab_slug_fkey(name,metadata)";
		const createQuery = () => {
			let query = getDataClient(c.env)
				.from(table)
				.select(select, { count: "exact" })
				.eq("hidden", false)
				.order("name", {
					ascending: true,
				});
			query = query.neq("status", "disabled");
			if (search) {
				query = query.ilike(
					"name",
					`%${search.replace(/[\\%_]/g, "\\$&")}%`,
				);
			}
			return query;
		};

		// Supabase returns at most 1,000 rows per REST request. Assemble a larger
		// requested page here so callers still receive one canonical API response.
		const databasePageSize = 1_000;
		const rows: Record<string, unknown>[] = [];
		let count = 0;
		for (let pageOffset = offset; pageOffset < offset + limit; pageOffset += databasePageSize) {
			const { data, error, count: pageCount } = await createQuery().range(
				pageOffset,
				Math.min(pageOffset + databasePageSize - 1, offset + limit - 1),
			);
			if (error) throw error;
			if (pageOffset === offset) count = pageCount ?? 0;
			const page = (data ?? []) as Record<string, unknown>[];
			rows.push(...page);
			if (page.length < databasePageSize) break;
		}

		const models = rows.map((model) => ({
			...model,
			...{
					model_id: model.model_slug,
					full_name: model.name,
					organisation_id: model.lab_slug,
					status: v2ModelStatus(model.status),
					release_date: model.released_at,
					announcement_date: model.announced_at,
					input_types: model.input_modalities,
					output_types: model.output_modalities,
					organisation: model.organisation && typeof model.organisation === "object"
						? {
							name: (model.organisation as Record<string, unknown>).name,
							colour: ((model.organisation as Record<string, unknown>).metadata as Record<string, unknown> | null)?.colour ?? null,
						}
						: null,
				},
			gateway_monitor_rows:
				gatewayRowsByModelId.get(String(model.model_slug ?? model.model_id ?? "")) ?? [],
		}));
		const response = withPublicCache(
			c.json({ models, total: count, limit, offset, catalogue_version: catalogueVersion }),
			cataloguePolicy(catalogueVersion),
		);
		await storeCatalogueInCache(c.req.raw, response);
		return response;
	} catch (error) {
		console.error("[web-api/models] catalogue failed", error);
		return c.json({ error: "models_unavailable" }, 503);
	}
});

/** Volatile provider circuit-breaker state shared by model provider lists. */
publicModelsRouter.get("/provider-routing-health", async (c) => {
	const providerIds = [...new Set(
		(c.req.query("provider_ids") ?? "")
			.split(",")
			.map((value) => value.trim())
			.filter(Boolean),
	)].sort((left, right) => left.localeCompare(right));
	if (providerIds.length === 0) {
		return withPublicCache(c.json({ providers: {} }), sectionPolicy("routingHealth"));
	}
	if (providerIds.length > 100) return c.json({ error: "too_many_provider_ids" }, 400);
	const windowHours = Math.max(1, parseBoundedInt(c.req.query("window_hours"), 24, 168));
	const nowMs = Date.now();
	const sinceIso = new Date(nowMs - windowHours * 60 * 60 * 1000).toISOString();
	try {
		const rows: Array<Record<string, unknown>> = [];
		for (let offset = 0; offset < 20_000; offset += 1_000) {
			const { data, error } = await getDataClient(c.env)
				.from("gateway_provider_health_states")
				.select("provider_id,breaker_state,is_deranked,open_until_ms,updated_at")
				.in("provider_id", providerIds)
				.gte("updated_at", sinceIso)
				.order("updated_at", { ascending: false })
				.range(offset, offset + 999);
			if (error) throw error;
			rows.push(...((data ?? []) as Array<Record<string, unknown>>));
			if ((data?.length ?? 0) < 1_000) break;
		}
		const providers = Object.fromEntries(providerIds.map((providerId) => {
			const matches = rows.filter((row) => row.provider_id === providerId);
			const openCount = matches.filter((row) => row.breaker_state === "open").length;
			const halfOpenCount = matches.filter((row) => row.breaker_state === "half_open").length;
			const deranked = matches.some((row) => Boolean(row.is_deranked)
				|| (row.breaker_state === "open" && Number(row.open_until_ms ?? 0) > nowMs));
			return [providerId, {
				providerId,
				deranked,
				recovering: !deranked && halfOpenCount > 0,
				openCount,
				halfOpenCount,
				checkedPairs: matches.length,
			}];
		}));
		return withPublicCache(c.json({ providers }), sectionPolicy("routingHealth"));
	} catch (error) {
		console.error("[web-api/models] provider routing health failed", { providerIds, error });
		return c.json({ error: "provider_routing_health_unavailable" }, 503);
	}
});

/** Public standard-rate rows used to enrich catalogue-only model cards. */
publicModelsRouter.get("/catalog-pricing-rules", async (c) => {
	try {
		const client = getDataClient(c.env);
		const skus = await client.from("v2_pricing_skus").select("sku_id,provider_model_id,service_tier_slug,effective_from,effective_to,description").neq("status", "disabled");
		if (skus.error) throw skus.error;
		const skuIds = (skus.data ?? []).map((row) => row.sku_id);
		const routeIds = [...new Set((skus.data ?? []).map((row) => row.provider_model_id))];
		const [meters, routes] = await Promise.all([
			skuIds.length ? client.from("v2_pricing_sku_meters").select("sku_id,meter_key,unit,unit_quantity,price_nanos").in("sku_id", skuIds) : Promise.resolve({ data: [], error: null }),
			routeIds.length ? client.from("v2_model_provider_routes").select("provider_model_id,provider_slug,model_slug").in("provider_model_id", routeIds) : Promise.resolve({ data: [], error: null }),
		]);
		if (meters.error) throw meters.error;
		if (routes.error) throw routes.error;
		const skuById = new Map((skus.data ?? []).map((row) => [row.sku_id, row]));
		const routeById = new Map((routes.data ?? []).map((row) => [row.provider_model_id, row]));
		const rows = (meters.data ?? []).flatMap((meter) => {
			const sku = skuById.get(meter.sku_id); const route = sku ? routeById.get(sku.provider_model_id) : null;
			const priceNanos = Number(meter.price_nanos); if (!sku || !route || !Number.isFinite(priceNanos)) return [];
			return [{ model_key: `${route.provider_slug}:${route.model_slug}`, pricing_plan: sku.service_tier_slug ?? "standard", meter: meter.meter_key, note: sku.description ?? null, unit: meter.unit, unit_size: Number(meter.unit_quantity ?? 1), price_per_unit: priceNanos / 1_000_000_000, effective_from: sku.effective_from, effective_to: sku.effective_to }];
		});
		return withPublicCache(c.json({ rules: rows }), sectionPolicy("catalogPricing"));
	} catch (error) {
		console.error("[web-api/models] catalogue pricing failed", error);
		return c.json({ error: "catalog_pricing_unavailable" }, 503);
	}
});

publicModelsRouter.get("/free-router-overview", async (c) => {
	try {
		return withPublicCache(c.json(await fetchFreeRouterOverview(c.env)), sectionPolicy("freeRouter"));
	} catch (error) {
		console.error("[web-api/models] free router overview failed", error);
		return c.json({ error: "free_router_overview_unavailable" }, 503);
	}
});

/** Stable model facts used by the overview, about, timeline, and SEO surfaces. */
publicModelsRouter.get("/:modelId", async (c) => {
	const modelId = c.req.param("modelId");
	try {
		const client = getDataClient(c.env);
		const v2Result = await client.rpc("get_v2_model_overview", {
			p_model_slug: modelId,
			p_region: c.req.query("region")?.trim().toLowerCase() || null,
			p_service_tier: c.req.query("service_tier")?.trim().toLowerCase() || null,
		});
		if (v2Result.error && !/could not find|does not exist|PGRST202/i.test(v2Result.error.message ?? "")) throw v2Result.error;
		const v2Overview = v2Result.data as Record<string, unknown> | null;
		if (v2Overview?.model_id) {
			const canonicalModelId = String(v2Overview.model_id);
			const [identityResult, aliasesResult, variants] = await Promise.all([
				client.rpc("get_v2_model_identity", { p_model_slug: canonicalModelId }),
				client.rpc("get_v2_model_aliases", { p_model_slug: canonicalModelId }),
				fetchModelVariants(c.env, canonicalModelId),
			]);
			if (identityResult.error) throw identityResult.error;
			if (aliasesResult.error) throw aliasesResult.error;
			const aliases = (aliasesResult.data ?? [])
				.map((row: Record<string, unknown>) => String(row.alias_slug ?? "").trim())
				.filter(Boolean);
			const identity = identityResult.data as Record<string, unknown> | null;
			return withPublicCache(c.json({ model: v2ModelPageShape(v2Overview, aliases, identity ?? {}, variants) }), sectionPolicy("overview", modelId));
		}
		return notFound(c);
	} catch (error) {
		console.error("[web-api/models] overview failed", { modelId, error });
		return c.json({ error: "model_unavailable" }, 503);
	}
});

/** Near-realtime request-window metrics; deliberately isolated from stable model facts. */
publicModelsRouter.get("/:modelId/realtime", async (c) => {
	const modelId = c.req.param("modelId");
	const windowMinutes = Math.max(1, parseBoundedInt(c.req.query("minutes"), 30, 24 * 60));
	try {
		const aliases = await modelAliases(c.env, modelId);
		const now = new Date();
		const sinceIso = new Date(now.getTime() - windowMinutes * 60_000).toISOString();
		const rows: Array<Record<string, unknown>> = [];
		for (let offset = 0; ; offset += 5_000) {
			const { data, error } = await getDataClient(c.env)
				.from("v2_web_gateway_requests")
				.select("latency_ms,throughput,generation_ms,usage")
				.in("model_id", aliases)
				.gte("created_at", sinceIso)
				.lte("created_at", now.toISOString())
				.order("created_at", { ascending: true })
				.range(offset, offset + 4_999);
			if (error) throw error;
			rows.push(...((data ?? []) as Array<Record<string, unknown>>));
			if ((data?.length ?? 0) < 5_000) break;
		}
		const latencies: number[] = [];
		const throughputs: number[] = [];
		for (const row of rows) {
			const latency = numberOrNull(row.latency_ms);
			if (latency != null && latency > 0) latencies.push(latency);
			const directThroughput = numberOrNull(row.throughput);
			if (directThroughput != null && directThroughput > 0) {
				throughputs.push(directThroughput);
				continue;
			}
			const generationMs = numberOrNull(row.generation_ms);
			const tokens = outputTokens(row.usage);
			if (generationMs != null && generationMs > 0 && tokens != null) {
				throughputs.push((tokens * 1_000) / generationMs);
			}
		}
		return withPublicCache(c.json({ stats: {
			requestsInWindow: rows.length,
			latencyP50Ms: median(latencies),
			throughputP50TokPerSec: median(throughputs),
		} }), sectionPolicy("realtime", modelId));
	} catch (error) {
		console.error("[web-api/models] realtime stats failed", { modelId, error });
		return c.json({ error: "model_realtime_unavailable" }, 503);
	}
});

publicModelsRouter.get("/:modelId/token-trajectory", async (c) => {
	const modelId = c.req.param("modelId");
	try {
		const client = getDataClient(c.env);
		const { data: model, error: modelError } = await client
			.from("v2_models")
			.select("model_slug")
			.eq("model_slug", modelId)
			.eq("hidden", false)
			.maybeSingle();
		if (modelError) throw modelError;
		if (!model) return notFound(c);
		const { data, error } = await client.rpc("get_model_token_trajectory", { p_model_id: modelId });
		if (error) throw error;
		const row = (data?.[0] ?? null) as Record<string, unknown> | null;
		if (!row?.release_date) {
			return withPublicCache(c.json({ trajectory: null }), sectionPolicy("trajectory", modelId));
		}
		const points = Array.isArray(row.points) ? row.points as Array<Record<string, unknown>> : [];
		const deprecationDate = typeof row.deprecation_date === "string" ? row.deprecation_date : null;
		const trajectory = {
			releaseDate: String(row.release_date),
			deprecationDate,
			deprecationDaysSinceRelease: deprecationDate
				? numberOrNull(points.find((point) => String(point.date ?? "").startsWith(deprecationDate.slice(0, 10)))?.daysSinceRelease)
				: null,
			points,
			tokenMilestones: Array.isArray(row.token_milestones) ? row.token_milestones : [],
			successorMilestones: Array.isArray(row.successor_milestones) ? row.successor_milestones : [],
		};
		return withPublicCache(c.json({ trajectory }), sectionPolicy("trajectory", modelId));
	} catch (error) {
		console.error("[web-api/models] token trajectory failed", { modelId, error });
		return c.json({ error: "model_token_trajectory_unavailable" }, 503);
	}
});

publicModelsRouter.get("/:modelId/header", async (c) => {
	const modelId = c.req.param("modelId");
	if (modelId === "phaseo/free") {
		return withPublicCache(c.json({ header: { model_id: "phaseo/free", name: "Phaseo Free Router", organisation_id: "phaseo", organisation: { name: "Phaseo", country_code: "" }, aliases: [], status: "Available", hidden: false } }), sectionPolicy("overview", modelId));
	}
	try {
		const client = getDataClient(c.env);
		const v2Result = await client.rpc("get_v2_model_overview", {
			p_model_slug: modelId,
			p_region: c.req.query("region")?.trim().toLowerCase() || null,
			p_service_tier: c.req.query("service_tier")?.trim().toLowerCase() || null,
		});
		if (v2Result.error && !/could not find|does not exist|PGRST202/i.test(v2Result.error.message ?? "")) throw v2Result.error;
		const v2Overview = v2Result.data as Record<string, unknown> | null;
		if (v2Overview?.model_id) {
			const [identityResult, aliasesResult] = await Promise.all([
				client.rpc("get_v2_model_identity", { p_model_slug: String(v2Overview.model_id) }),
				client.rpc("get_v2_model_aliases", { p_model_slug: String(v2Overview.model_id) }),
			]);
			if (identityResult.error) throw identityResult.error;
			if (aliasesResult.error) throw aliasesResult.error;
			const model = v2ModelPageShape(v2Overview, (aliasesResult.data ?? []).map((row: Record<string, unknown>) => String(row.alias_slug ?? "").trim()).filter(Boolean), (identityResult.data as Record<string, unknown> | null) ?? {});
			return withPublicCache(c.json({ header: {
				model_id: model.model_id,
				name: model.name,
				organisation_id: model.organisation_id,
				organisation: model.organisation,
				aliases: model.aliases,
				family_id: model.family_id ?? undefined,
				status: model.status,
				hidden: false,
			} }), sectionPolicy("overview", modelId));
		}
		return notFound(c);
	} catch (error) {
		console.error("[web-api/models] header failed", { modelId, error });
		return c.json({ error: "model_header_unavailable" }, 503);
	}
});

publicModelsRouter.get("/:modelId/canonical", async (c) => {
	const requestedModelId = c.req.param("modelId").trim();
	const unresolved = { requestedModelId, canonicalModelId: null, internalModelId: null, source: "unresolved" as const };
	if (!requestedModelId) return withPublicCache(c.json({ resolution: unresolved }), sectionPolicy("overview"));
	try {
		const client = getDataClient(c.env);
		const v2Result = await client.rpc("get_v2_model_resolution", { p_requested_slug: requestedModelId });
		const v2Resolution = v2Result.data as Record<string, unknown> | null;
		if (!v2Result.error && v2Resolution && v2Resolution.canonicalModelId) {
			return withPublicCache(c.json({ resolution: v2Resolution }), sectionPolicy("overview", requestedModelId));
		}
		if (v2Result.error && !/could not find|does not exist|PGRST202/i.test(v2Result.error.message ?? "")) throw v2Result.error;
		return withPublicCache(c.json({ resolution: unresolved }), sectionPolicy("overview", requestedModelId));
	} catch (error) {
		console.error("[web-api/models] canonical resolution failed", { requestedModelId, error });
		return c.json({ error: "model_resolution_unavailable" }, 503);
	}
});

publicModelsRouter.get("/:modelId/availability", async (c) => {
	const modelId = c.req.param("modelId");
	try {
		const client = getDataClient(c.env);
		const v2Result = await client.rpc("get_v2_model_availability", {
			p_model_slug: modelId,
			p_region: c.req.query("region")?.trim().toLowerCase() || null,
			p_service_tier: c.req.query("service_tier")?.trim().toLowerCase() || "standard",
		});
		const v2AvailabilityPayload = v2Result.data as Record<string, unknown> | Array<Record<string, unknown>> | null;
		const v2Availability = Array.isArray(v2AvailabilityPayload) ? v2AvailabilityPayload[0] : v2AvailabilityPayload;
		if (!v2Result.error && v2Availability && "is_gateway_active" in v2Availability) {
			return withPublicCache(c.json({ availability: {
				isGatewayActive: Boolean(v2Availability.is_gateway_active),
				activeProviderCount: Number(v2Availability.active_provider_count ?? 0),
			} }), sectionPolicy("catalogue", modelId));
		}
		if (v2Result.error && !/could not find|does not exist|PGRST202/i.test(v2Result.error.message ?? "")) throw v2Result.error;
		return withPublicCache(c.json({ availability: { isGatewayActive: false, activeProviderCount: 0 } }), sectionPolicy("catalogue", modelId));
	} catch (error) {
		console.error("[web-api/models] availability failed", { modelId, error });
		return c.json({ error: "model_availability_unavailable" }, 503);
	}
});

publicModelsRouter.get("/:modelId/usage-daily", async (c) => {
	const modelId = c.req.param("modelId");
	try {
		const days = Math.max(1, Math.min(365, parseBoundedInt(c.req.query("days"), 30, 365))); const now = new Date(); const defaultSince = new Date(now); defaultSince.setUTCDate(defaultSince.getUTCDate() - days);
		const providerIds = [...new Set((c.req.query("provider_ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean))]; const client = getDataClient(c.env);
		const v2 = await client.rpc("get_v2_model_usage_daily", { p_model_slug: modelId, p_provider_ids: providerIds.length ? providerIds.sort() : null, p_since: c.req.query("since")?.slice(0, 10) || defaultSince.toISOString().slice(0, 10), p_until: c.req.query("until")?.slice(0, 10) || now.toISOString().slice(0, 10) });
		if (v2.error) throw v2.error;
		if (!Array.isArray(v2.data)) throw new Error("V2 usage query returned an invalid payload");
		return withPublicCache(c.json({ rows: (v2.data as Array<Record<string, unknown>>).map(mapUsageDailyRow), source: "v2" }), sectionPolicy("usageDaily", modelId));
	} catch (error) { console.error("[web-api/models] usage daily failed", { modelId, error }); return c.json({ error: "model_usage_daily_unavailable" }, 503); }
});

publicModelsRouter.get("/:modelId/provider-health", async (c) => {
	const modelId = c.req.param("modelId");
	const percentile = parsePercentile(c.req.query("percentile"));
	const providerIds = [...new Set((c.req.query("provider_ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean))].sort();
	if (!providerIds.length) return withPublicCache(c.json({ rows: [] }), sectionPolicy("providerHealth", modelId));
	try {
		const windowDays = Math.max(1, Math.min(90, parseBoundedInt(c.req.query("window_days"), 3, 90)));
		const v2 = await getDataClient(c.env).rpc("get_v2_model_provider_health_metrics", { p_model_slug: modelId, p_window_days: windowDays, p_percentile: percentile / 100 });
		if (!v2.error && Array.isArray(v2.data)) {
			const rows = (v2.data as Array<Record<string, unknown>>).filter((row) => providerIds.includes(String(row.provider_id ?? "")));
			return withPublicCache(c.json({ rows, source: "v2" }), sectionPolicy("providerHealth", modelId));
		}
		throw v2.error ?? new Error("V2 provider health query returned an invalid payload");
	} catch (error) { console.error("[web-api/models] provider health failed", { modelId, error }); return c.json({ error: "model_provider_health_unavailable" }, 503); }
});

publicModelsRouter.get("/:modelId/pricing-history", async (c) => {
	const modelId = c.req.param("modelId"); const days = Math.max(1, Math.min(365, parseBoundedInt(c.req.query("days"), 30, 365))); const now = Date.now(); const windowStart = now - days * 24 * 60 * 60 * 1_000;
	try {
		const { providerRows, pricingRows } = await fetchModelPricingSources(c.env, [modelId]);
		const providerNames = new Map(providerRows.map((row) => {
			const provider = Array.isArray(row.data_api_providers) ? row.data_api_providers[0] : row.data_api_providers as Record<string, unknown> | null;
			return [String(row.provider_id ?? ""), String(provider?.api_provider_name ?? row.provider_id ?? "")];
		}));
		const rules = pricingRows.flatMap((row) => { const from = row.effective_from ? Date.parse(String(row.effective_from)) : Number.NEGATIVE_INFINITY; const to = row.effective_to ? Date.parse(String(row.effective_to)) : Number.POSITIVE_INFINITY; if (to < windowStart || from > now) return []; const modelKey = String(row.model_key ?? ""); const providerId = modelKey.split(":")[0] ?? ""; const unitSize = Number(row.unit_size ?? 1); const pricePerUnit = Number(row.price_per_unit); const meter = String(row.meter ?? "").trim().toLowerCase(); if (!providerId || !row.rule_id || !modelKey || !meter || !Number.isFinite(unitSize) || unitSize <= 0 || !Number.isFinite(pricePerUnit) || pricePerUnit < 0) return []; return [{ ruleId: row.rule_id, providerId, providerName: providerNames.get(providerId) ?? providerId, modelKey, pricingPlan: String(row.pricing_plan ?? "standard"), meter, unit: String(row.unit ?? "token").toLowerCase(), unitSize, pricePerUnit, pricePer1MUnits: pricePerUnit * (1_000_000 / unitSize), currency: String(row.currency ?? "USD"), priority: Number(row.priority ?? 100), effectiveFrom: row.effective_from ?? null, effectiveTo: row.effective_to ?? null, note: row.note ?? null, match: Array.isArray(row.match) ? row.match : [] }]; }).sort((a, b) => a.providerName.localeCompare(b.providerName) || a.meter.localeCompare(b.meter) || (Date.parse(String(b.effectiveFrom ?? "")) || Number.NEGATIVE_INFINITY) - (Date.parse(String(a.effectiveFrom ?? "")) || Number.NEGATIVE_INFINITY));
		return withPublicCache(c.json({ rules }), sectionPolicy("pricingHistory", modelId));
	} catch (error) { console.error("[web-api/models] pricing history failed", { modelId, error }); return c.json({ error: "model_pricing_history_unavailable" }, 503); }
});

publicModelsRouter.get("/:modelId/gateway-metadata-source", async (c) => {
	const modelId = c.req.param("modelId");
	try {
		const source = await fetchGatewayMetadataSource(c.env, modelId);
		if (!source) return notFound(c);
		return withPublicCache(c.json({ source }), sectionPolicy("pricing", modelId));
	} catch (error) { console.error("[web-api/models] gateway metadata source failed", { modelId, error }); return c.json({ error: "model_gateway_metadata_unavailable" }, 503); }
});

publicModelsRouter.get("/:modelId/gateway-metadata", async (c) => {
	const modelId = c.req.param("modelId");
	try {
		const source = await fetchGatewayMetadataSource(c.env, modelId);
		if (!source) return notFound(c);
		return withPublicCache(c.json({ metadata: composeGatewayMetadata(modelId, source) }), sectionPolicy("pricing", modelId));
	} catch (error) {
		console.error("[web-api/models] gateway metadata failed", { modelId, error });
		return c.json({ error: "model_gateway_metadata_unavailable" }, 503);
	}
});

publicModelsRouter.get("/:modelId/notice", async (c) => {
	const modelId = c.req.param("modelId");
	try {
		const apiModelId = await resolveNoticeApiModelId(c.env, modelId);
		if (!apiModelId) {
			return withPublicCache(c.json({ notice: null }), sectionPolicy("notice", modelId));
		}
		const { data, error } = await getDataClient(c.env)
			.from("v2_model_page_notices")
			.select("api_model_id:model_slug,tone,markdown")
			.eq("model_slug", apiModelId)
			.maybeSingle();
		if (error) throw error;
		const tone = String(data?.tone ?? "").trim();
		const markdown = String(data?.markdown ?? "").trim();
		const notice = data && apiModelId && markdown && ["info", "warning", "critical"].includes(tone)
			? { apiModelId, tone, markdown }
			: null;
		return withPublicCache(c.json({ notice }), sectionPolicy("notice", modelId));
	} catch (error) {
		console.error("[web-api/models] notice failed", { modelId, error });
		return c.json({ error: "model_notice_unavailable" }, 503);
	}
});

publicModelsRouter.get("/:modelId/apps", async (c) => {
	const modelId = c.req.param("modelId"); const limit = Math.max(1, Math.min(100, parseBoundedInt(c.req.query("limit"), 24, 100)));
	try {
		const client = getDataClient(c.env);
		const v2 = await client.rpc("get_v2_model_apps", { p_model_slug: modelId, p_limit: limit });
		if (!v2.error && Array.isArray(v2.data)) {
			const apps = (v2.data as Array<Record<string, unknown>>).map((row) => { const appId = String(row.app_id ?? "").trim(); return appId ? { appId, title: String(row.title ?? appId).trim() || appId, imageUrl: typeof row.image_url === "string" && row.image_url.trim() ? row.image_url.trim() : null, url: typeof row.url === "string" && row.url.trim() ? row.url.trim() : null, lastSeen: typeof row.last_seen === "string" && row.last_seen.trim() ? row.last_seen : null, totalRequests: Math.max(0, Math.round(Number(row.requests ?? 0) || 0)), successfulRequests: Math.max(0, Math.round(Number(row.success_requests ?? 0) || 0)), totalTokens: Math.max(0, Math.round(Number(row.total_tokens ?? 0) || 0)) } : null; }).filter((row): row is NonNullable<typeof row> => Boolean(row));
			return withPublicCache(c.json({ apps, source: "v2" }), sectionPolicy("apps", modelId));
		}
		throw v2.error ?? new Error("V2 apps query returned an invalid payload");
	} catch (error) { console.error("[web-api/models] apps failed", { modelId, error }); return c.json({ error: "model_apps_unavailable" }, 503); }
});

/** Benchmark results are isolated so their long-lived cache never holds up live performance data. */
publicModelsRouter.get("/:modelId/benchmarks", async (c) => {
	const modelId = c.req.param("modelId");
	try {
		const client = getDataClient(c.env);
		const v2 = await client.rpc("get_v2_model_benchmarks", { p_model_slug: modelId });
		if (!v2.error && (v2.data == null || Array.isArray(v2.data))) {
			const results = ((v2.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
				id: row.result_id, benchmark_id: row.benchmark_id, score: row.score, score_numeric: row.score_numeric,
				is_self_reported: row.is_self_reported, other_info: row.other_info, source_link: row.source_link,
				created_at: row.created_at, updated_at: row.updated_at, rank: row.result_rank, occur_idx: row.occur_idx,
				variant: row.variant, result_key: row.result_key,
				benchmark: { id: row.benchmark_id, name: row.benchmark_name, category: row.category, link: row.link, total_models: row.total_models, ascending_order: row.ascending_order, type: row.benchmark_type },
			}));
			return withPublicCache(c.json({ modelId, results, highlights: benchmarkHighlights(results), source: "v2" }), sectionPolicy("benchmarks", modelId));
		}
		throw v2.error ?? new Error("V2 benchmark query returned an invalid payload");
	} catch (error) {
		console.error("[web-api/models] benchmarks failed", { modelId, error });
		return c.json({ error: "benchmarks_unavailable" }, 503);
	}
});

publicModelsRouter.get("/:modelId/timeline", async (c) => {
	const modelId = c.req.param("modelId");
	try {
		const client = getDataClient(c.env);
		const { data: model, error } = await client
			.from("v2_models")
			.select("model_slug,name,previous_model_slug,announced_at,released_at,deprecated_at,retired_at")
			.eq("model_slug", modelId)
			.eq("hidden", false)
			.maybeSingle();
		if (error) throw error;
		if (!model) return notFound(c);
		const [previousResult, futureResult] = await Promise.all([
			model.previous_model_slug
				? client.from("v2_models").select("model_slug,name,announced_at,released_at").eq("model_slug", model.previous_model_slug).eq("hidden", false).maybeSingle()
				: Promise.resolve({ data: null, error: null }),
			client.from("v2_models").select("model_slug,name,announced_at,released_at").eq("previous_model_slug", modelId).eq("hidden", false),
		]);
		if (previousResult.error) throw previousResult.error;
		if (futureResult.error) throw futureResult.error;
		const events: Array<Record<string, string>> = [];
		for (const [date, eventName] of [[model.announced_at, "Announced"], [model.released_at, "Released"], [model.deprecated_at, "Deprecated"], [model.retired_at, "Retired"]] as const) {
			if (date) events.push({ date, eventType: "ModelEvent", eventName });
		}
		const previous = previousResult.data;
		const previousDate = previous?.released_at ?? previous?.announced_at;
		if (previous && previousDate) events.push({ date: previousDate, eventType: "PreviousModel", modelId: previous.model_slug, modelName: previous.name ?? previous.model_slug });
		const future = (futureResult.data ?? [])
			.map((candidate) => ({ candidate, date: candidate.released_at ?? candidate.announced_at }))
			.filter((entry): entry is { candidate: NonNullable<typeof entry.candidate>; date: string } => Boolean(entry.date))
			.sort((left, right) => left.date.localeCompare(right.date))[0];
		if (future) events.push({ date: future.date, eventType: "FutureModel", modelId: future.candidate.model_slug, modelName: future.candidate.name ?? future.candidate.model_slug });
		events.sort((left, right) => right.date.localeCompare(left.date));
		return withPublicCache(c.json({ events }), sectionPolicy("timeline", modelId));
	} catch (error) {
		console.error("[web-api/models] timeline failed", { modelId, error });
		return c.json({ error: "timeline_unavailable" }, 503);
	}
});

publicModelsRouter.get("/:modelId/subscription-plans", async (c) => {
	const modelId = c.req.param("modelId");
	try {
		const client = getDataClient(c.env);
		const v2 = await client.rpc("get_v2_model_subscription_plans", { p_model_slug: modelId });
		if (!v2.error && (v2.data == null || Array.isArray(v2.data))) {
			const grouped = new Map<string, Record<string, unknown>>();
			for (const row of (v2.data ?? []) as Array<Record<string, unknown>>) {
				const planId = String(row.plan_id ?? "").trim(); if (!planId) continue;
				const plan = grouped.get(planId) ?? { plan_id: planId, plan_uuid: row.plan_uuid, name: row.name, organisation_id: row.lab_slug, description: row.description, link: row.link, other_info: row.other_info, created_at: row.created_at, updated_at: row.updated_at, organisation: row.lab_slug ? { organisation_id: row.lab_slug, name: row.lab_slug } : null, prices: [], model_info: { model_info: row.model_info, rate_limit: row.rate_limit, other_info: row.model_other_info } };
				(plan.prices as Array<Record<string, unknown>>).push({ price: row.price, currency: row.currency, frequency: row.frequency }); grouped.set(planId, plan);
			}
			return withPublicCache(c.json({ subscription_plans: Array.from(grouped.values()), source: "v2" }), sectionPolicy("subscriptions", modelId));
		}
		throw v2.error ?? new Error("V2 subscription query returned an invalid payload");
	} catch (error) {
		console.error("[web-api/models] subscription plans failed", { modelId, error });
		return c.json({ error: "model_subscription_plans_unavailable" }, 503);
	}
});

/** Pricing changes independently from model metadata, so it intentionally has its own shorter cache. */
publicModelsRouter.get("/:modelId/pricing", async (c) => {
	const modelId = c.req.param("modelId");
	try {
		const client = getDataClient(c.env);
		const requestedServiceTier = c.req.query("service_tier")?.trim().toLowerCase() || null;
		const v2PricingPromise = client.rpc("get_v2_model_pricing", {
			p_model_slug: modelId,
			p_region: c.req.query("region")?.trim().toLowerCase() || null,
			p_service_tier: requestedServiceTier,
		});
		const standardPricingPromise = requestedServiceTier === null
			? client.rpc("get_v2_model_pricing", {
				p_model_slug: modelId,
				p_region: c.req.query("region")?.trim().toLowerCase() || null,
				p_service_tier: "standard",
			})
			: Promise.resolve(null);
		const [v2Pricing, standardPricing] = await Promise.all([
			v2PricingPromise,
			standardPricingPromise,
		]);
		if (!v2Pricing.error && Array.isArray(v2Pricing.data)) {
			const providers = requestedServiceTier === null
				&& standardPricing
				&& !standardPricing.error
				&& Array.isArray(standardPricing.data)
				? mergeStandardPricingAvailability(
					v2Pricing.data as Array<Record<string, unknown>>,
					standardPricing.data as Array<Record<string, unknown>>,
				)
				: v2Pricing.data as Array<Record<string, unknown>>;
			if (c.req.query("shape") === "source") {
				return withPublicCache(c.json({
					modelId,
					provider_rows: providers.map((row) => row.provider).filter(Boolean),
					pricing_rules: providers.flatMap((row) => Array.isArray(row.pricing_rules) ? row.pricing_rules : []),
				}), sectionPolicy("pricing", modelId));
			}
			return withPublicCache(c.json({ modelId, providers }), sectionPolicy("pricing", modelId));
		}
		throw v2Pricing.error ?? new Error("V2 pricing query returned an invalid payload");
	} catch (error) {
		console.error("[web-api/models] pricing failed", { modelId, error });
		return c.json({ error: "pricing_unavailable" }, 503);
	}
});

/** Available Cloudflare execution colos for a model, used by the performance filter. */
publicModelsRouter.get("/:modelId/performance/colos", async (c) => {
	const modelId = c.req.param("modelId");
	try {
		const client = getDataClient(c.env);
		const result = await client.rpc("get_v2_model_performance_colos", { p_model_slug: modelId });
		if (result.error && !/could not find|does not exist|PGRST202/i.test(result.error.message ?? "")) throw result.error;
		const colos = Array.isArray(result.data)
			? (result.data as Array<Record<string, unknown>>).map((row) => ({
				colo: String(row.cloudflare_colo ?? "").trim().toUpperCase(),
				requests: Number(row.request_count ?? 0),
			})).filter((row) => /^[A-Z0-9]{3}$/.test(row.colo))
			: [];
		return withPublicCache(c.json({ modelId, colos }), sectionPolicy("performance", modelId));
	} catch (error) {
		console.error("[web-api/models] performance colos failed", { modelId, error });
		return c.json({ error: "performance_colos_unavailable" }, 503);
	}
});

/** 15-minute cache for the live-ish performance rollup; raw RPC payload preserves the source fidelity. */
publicModelsRouter.get("/:modelId/performance", async (c) => {
	const modelId = c.req.param("modelId");
	const cloudflareColo = c.req.query("colo")?.trim().toUpperCase() || null;
	const percentile = parsePercentile(c.req.query("percentile"));
	const streamMode = ["stream", "non_stream"].includes(c.req.query("stream") ?? "")
		? c.req.query("stream")
		: "all";
	const contextBucket = ["lte_4k", "4k_16k", "16k_64k", "gt_64k"].includes(c.req.query("context") ?? "")
		? c.req.query("context")
		: "all";
	try {
		const client = getDataClient(c.env);
		const [v2, health, cachedInput] = await Promise.all([
			client.rpc("get_v2_model_performance_metrics", {
				p_model_slug: modelId,
				p_cloudflare_colo: cloudflareColo,
				p_percentile: percentile / 100,
				p_stream_mode: streamMode,
				p_context_bucket: contextBucket,
			}),
			client.rpc("get_v2_model_provider_health_metrics", { p_model_slug: modelId, p_window_days: 3, p_percentile: percentile / 100 }),
			client.rpc("get_v2_model_cached_input_metrics", {
				p_model_slug: modelId,
				p_cloudflare_colo: cloudflareColo,
				p_stream_mode: streamMode,
				p_context_bucket: contextBucket,
			}),
		]);
		let performance: Record<string, any> | null = null;
		if (!v2.error && v2.data && !Array.isArray(v2.data) && typeof v2.data === "object") {
			performance = v2.data as Record<string, any>;
		} else if (v2.error && !/could not find|does not exist|PGRST202/i.test(v2.error.message ?? "")) {
			throw v2.error;
		} else throw v2.error ?? new Error("V2 performance query returned an invalid payload");
		if (
			!cloudflareColo &&
			streamMode === "all" &&
			contextBucket === "all" &&
			!health.error &&
			Array.isArray(health.data) &&
			health.data.length > 0 &&
			performance
		) {
			performance = {
				...performance,
				provider_uptime_24h: (health.data as Array<Record<string, unknown>>).map((row) => ({
					provider: row.provider_id, provider_name: row.provider_name ?? row.provider_id, requests: row.health_requests ?? row.requests,
					uptime_pct: row.uptime_pct, avg_latency_ms: row.percentile_latency_ms ?? row.avg_latency_ms, avg_generation_ms: null, avg_throughput: row.percentile_throughput ?? row.avg_throughput,
					uptime_buckets: row.buckets ?? [],
				})),
			};
		}
		if (!performance) return withPublicCache(c.json({ modelId, performance: null, metrics: null, activity: null }), sectionPolicy("performance", modelId));
		const isKnownProvider = (value: Record<string, unknown>) => {
			const provider = String(value.provider ?? "").trim().toLowerCase();
			return provider.length > 0 && provider !== "unknown";
		};
		performance = {
			...performance,
			provider_uptime_24h: (performance.provider_uptime_24h ?? []).filter(isKnownProvider),
			provider_daily_7d: (performance.provider_daily_7d ?? []).filter(isKnownProvider),
		};
		const providerSlugs = [...new Set([
			...(performance.provider_uptime_24h ?? []).map((value: Record<string, unknown>) => String(value.provider ?? "")),
			...(performance.provider_daily_7d ?? []).map((value: Record<string, unknown>) => String(value.provider ?? "")),
		].map((provider) => provider.trim().toLowerCase()).filter(Boolean))];
		const providerMetadata = providerSlugs.length > 0
			? await client.from("v2_providers").select("provider_slug,metadata").in("provider_slug", providerSlugs)
			: { data: [], error: null };
		if (providerMetadata.error) throw providerMetadata.error;
		const providerColors = new Map((providerMetadata.data ?? []).map((row) => {
			const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
				? row.metadata as Record<string, unknown>
				: {};
			const color = typeof metadata.colour === "string" && metadata.colour.trim()
				? metadata.colour.trim()
				: null;
			return [String(row.provider_slug).trim().toLowerCase(), color] as const;
		}));
		const providerColor = (provider: unknown) => providerColors.get(String(provider ?? "").trim().toLowerCase()) ?? null;
		const number = (value: unknown) => { const parsed = Number(value); return value == null || !Number.isFinite(parsed) ? null : parsed; };
		const summary = (value: Record<string, unknown> | null | undefined) => ({ avgThroughput: number(value?.avg_throughput), avgOutputSpeed: number(value?.output_speed_tps), avgLatencyMs: number(value?.avg_latency_ms), avgGenerationMs: number(value?.avg_generation_ms), avgPhaseoOverheadMs: number(value?.phaseo_overhead_ms), avgTpotMs: number(value?.tpot_ms), avgItlMs: number(value?.itl_ms), uptimePct: number(value?.uptime_pct), totalRequests: Number(value?.total_requests ?? 0), successfulRequests: Number(value?.successful_requests ?? 0) });
		const cachedInputMetrics = (cachedInput.data ?? {}) as Record<string, any>;
		const cachedInputHourly = new Map((cachedInputMetrics.hourly_24h ?? []).map((value: Record<string, unknown>) => [String(value.bucket ?? ""), value]));
		const cachedInputProviderDaily = new Map((cachedInputMetrics.provider_daily_7d ?? []).map((value: Record<string, unknown>) => [`${String(value.day ?? "")}:${String(value.provider ?? "")}`, value]));
		const hourly = (performance.hourly_24h ?? []).map((value: Record<string, unknown>) => {
			const cache = cachedInputHourly.get(String(value.bucket ?? "")) as Record<string, unknown> | undefined;
			return { bucket: value.bucket ?? "", avgThroughput: number(value.avg_throughput), avgOutputSpeed: number(value.output_speed_tps), avgLatencyMs: number(value.avg_latency_ms), avgGenerationMs: number(value.avg_generation_ms), avgPhaseoOverheadMs: number(value.phaseo_overhead_ms), avgTpotMs: number(value.tpot_ms), avgItlMs: number(value.itl_ms), cachedInputPct: number(cache?.cached_input_pct), cacheTelemetryRequests: Number(cache?.telemetry_requests ?? 0), requests: Number(value.requests ?? 0), successPct: number(value.success_pct) };
		});
		const providerPerformance = (performance.provider_uptime_24h ?? []).map((value: Record<string, any>) => ({ provider: value.provider ?? "", providerName: value.provider_name ?? value.provider ?? "", providerColor: providerColor(value.provider), avgThroughput: number(value.avg_throughput), avgLatencyMs: number(value.avg_latency_ms), avgGenerationMs: number(value.avg_generation_ms), requests: Number(value.requests ?? 0), uptimePct: number(value.uptime_pct), uptimeBuckets: (value.uptime_buckets ?? []).map((bucket: Record<string, unknown>) => ({ start: bucket.start ?? "", end: bucket.end ?? "", successPct: number(bucket.success_pct) })) }));
		const providerDaily7d = (performance.provider_daily_7d ?? []).map((value: Record<string, unknown>) => {
			const cache = cachedInputProviderDaily.get(`${String(value.day ?? "")}:${String(value.provider ?? "")}`) as Record<string, unknown> | undefined;
			return { day: value.day ?? "", provider: value.provider ?? "", providerName: value.provider_name ?? value.provider ?? "", providerColor: providerColor(value.provider), avgThroughput: number(value.avg_throughput), avgOutputSpeed: number(value.output_speed_tps), avgLatencyMs: number(value.avg_latency_ms), avgGenerationMs: number(value.avg_generation_ms), avgPhaseoOverheadMs: number(value.phaseo_overhead_ms), avgTpotMs: number(value.tpot_ms), avgItlMs: number(value.itl_ms), cachedInputPct: number(cache?.cached_input_pct), cachedInputTokens: number(cache?.cached_input_tokens), effectiveInputTokens: number(cache?.effective_input_tokens), cacheTelemetryRequests: Number(cache?.telemetry_requests ?? 0), requests: Number(value.requests ?? 0) };
		});
		const providerCount = providerPerformance.filter((provider: Record<string, unknown>) => Number(provider.requests ?? 0) > 0).length;
		const sevenDayProviderCount = new Set(
			providerDaily7d
				.filter((provider) => provider.requests > 0)
				.map((provider) => provider.provider),
		).size;
		const percentileSeries = sevenDayProviderCount === 1
			? await client.rpc("get_v2_model_provider_percentile_series_v2", {
				p_model_slug: modelId,
				p_cloudflare_colo: cloudflareColo,
				p_stream_mode: streamMode,
				p_context_bucket: contextBucket,
			})
			: { data: [], error: null };
		if (percentileSeries.error && !/could not find|does not exist|PGRST202/i.test(percentileSeries.error.message ?? "")) {
			throw percentileSeries.error;
		}
		const successSeries = (performance.hourly_24h ?? []).map((value: Record<string, unknown>) => ({ bucket: value.bucket ?? "", overallSuccessPct: number(value.success_pct), worstProviderSuccessPct: providerCount > 1 ? number(value.worst_provider_success_pct) : null, providerCount, requests: Number(value.requests ?? 0) }));
		const timeOfDay = (performance.time_of_day_5d ?? []).map((value: Record<string, unknown>) => ({ hour: Number(value.hour ?? 0), avgThroughput: number(value.avg_throughput), avgLatencyMs: number(value.avg_latency_ms), avgGenerationMs: number(value.avg_generation_ms), sampleCount: Number(value.sample_count ?? 0) }));
		const providerPercentileDaily7d = (Array.isArray(percentileSeries.data) ? percentileSeries.data : []).map((value: Record<string, unknown>) => {
			const seriesPercentile = Number(value.percentile);
			return {
				day: value.usage_day ?? "",
				provider: value.provider_id ?? "",
				providerName: value.provider_name ?? value.provider_id ?? "",
				providerColor: providerColor(value.provider_id),
				percentile: seriesPercentile,
				avgThroughput: number(value.effective_throughput_tps),
				avgOutputSpeed: number(value.output_speed_tps),
				avgLatencyMs: number(value.gateway_ttft_ms),
				avgGenerationMs: number(value.provider_duration_ms),
				avgPhaseoOverheadMs: number(value.phaseo_overhead_ms),
				avgTpotMs: number(value.tpot_ms),
				avgItlMs: number(value.itl_ms),
				cachedInputPct: number(value.cached_input_pct),
				requests: Number(value.requests ?? 0),
			};
		}).filter((value) => String(value.provider).trim().length > 0);
		const qualitySeries = (performance.quality_series ?? []).map((value: Record<string, unknown>) => ({ bucket: value.bucket ?? "", toolCallSuccessPct: number(value.tool_call_success_pct), structuredOutputSuccessPct: number(value.structured_output_success_pct), cacheHitRatePct: number(value.cache_hit_rate_pct), requests: Number(value.requests ?? 0) }));
		const metrics = { cloudflareColo: performance.cloudflare_colo ?? cloudflareColo, percentile, streamMode, contextBucket, summary: summary(performance.last_24h), prevSummary: performance.prev_24h ? summary(performance.prev_24h) : null, hourly, successSeries, timeOfDay, providerPerformance, providerDaily7d, providerPercentileDaily7d, qualitySeries, dataRange: hourly.length ? { start: hourly[0]?.bucket ?? "", end: hourly[hourly.length - 1]?.bucket ?? "" } : { start: "", end: "" }, cumulativeTokens: number(performance.cumulative_tokens?.total_tokens), releaseDate: performance.cumulative_tokens?.release_date ?? null };
		const activity = { summary: metrics.summary, providerPerformance, cumulativeTokens: metrics.cumulativeTokens };
		return withPublicCache(c.json({ modelId, performance, metrics, activity }), sectionPolicy("performance", modelId));
	} catch (error) {
		console.error("[web-api/models] performance failed", { modelId, error });
		return c.json({ error: "performance_unavailable" }, 503);
	}
});
