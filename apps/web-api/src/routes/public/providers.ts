import { Hono } from "hono";
import type { Env } from "@/env";
import { withPublicCache, type PublicCachePolicy } from "@/http/cache";
import { listProviderIndexRows } from "@/repositories/provider-index";
import { getProviderAppMetadata, getProviderModelNames, getProviderRecentTokens, listProviderRecentModels, listProviderRollups, listProviderTopApps, listProviderTopModels, loadProviderModelCatalogue } from "@/repositories/provider-telemetry";

const TELEMETRY_CACHE: PublicCachePolicy = {
	edgeTtlSeconds: 15 * 60,
	staleWhileRevalidateSeconds: 15 * 60,
	cacheTags: ["web-api-providers", "web-api-provider-telemetry"],
};
const UPDATES_CACHE: PublicCachePolicy = {
	edgeTtlSeconds: 60 * 60,
	staleWhileRevalidateSeconds: 24 * 60 * 60,
	cacheTags: ["web-api-providers", "web-api-provider-updates"],
};
const IDENTITY_CACHE: PublicCachePolicy = { edgeTtlSeconds: 24 * 60 * 60, staleWhileRevalidateSeconds: 7 * 24 * 60 * 60, cacheTags: ["web-api-providers"] };
const MODALITIES = ["text", "image", "video", "audio", "moderation", "embedding"] as const;
type Modality = typeof MODALITIES[number];
type Variant = { id: string; name: string; colour: string | null; country: string; family: string | null; offerLabel: string | null; offerScope: string | null; isGatewayProvider: boolean; promptTrainingPolicy: string | null; dataPolicyTier: string | null; zeroDataRetention: string | null; dataRetentionDays: number | null; privacyPolicyUrl: string | null; termsOfServiceUrl: string | null; totalIds: string[]; activeIds: string[]; freeIds: string[]; dailyRequests: number; dailyTokens: number; monthlyTokens: number; updatedAt: string | null; modalities: Record<Modality, { input: string[]; output: string[] }> };
type ProviderIndexRpcRow = {
	provider_slug: string; provider_name: string; colour: string | null; country_code: string | null;
	provider_family_id: string | null; offer_label: string | null; offer_scope: string | null; is_gateway_provider: boolean;
	prompt_training_policy: string | null; data_policy_tier: string | null; zero_data_retention: string | null; data_retention_days: number | null;
	privacy_policy_url: string | null; terms_of_service_url: string | null;
	total_model_ids: string[] | null; active_model_ids: string[] | null; free_model_ids: string[] | null;
	requests_24h: number | string | null; tokens_24h: number | string | null; tokens_30d: number | string | null;
	last_updated_at: string | null;
	text_input_model_ids: string[] | null; text_output_model_ids: string[] | null;
	image_input_model_ids: string[] | null; image_output_model_ids: string[] | null;
	video_input_model_ids: string[] | null; video_output_model_ids: string[] | null;
	audio_input_model_ids: string[] | null; audio_output_model_ids: string[] | null;
	moderation_input_model_ids: string[] | null; moderation_output_model_ids: string[] | null;
	embedding_input_model_ids: string[] | null; embedding_output_model_ids: string[] | null;
};

function providerPolicy(base: PublicCachePolicy, providerId: string): PublicCachePolicy {
	return { ...base, cacheTags: [...(base.cacheTags ?? []), `web-api-provider-${providerId}`.slice(0, 128)] };
}

function boundedInt(value: string | undefined, fallback: number, max: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? Math.max(1, Math.min(max, Math.trunc(parsed))) : fallback;
}

function missingRelation(error: unknown): boolean {
	const message = String((error as { message?: unknown })?.message ?? "").toLowerCase();
	return message.includes("does not exist") || message.includes("could not find") || message.includes("relation") || message.includes("schema cache");
}

type PricingRule = { model_key: string; pricing_plan: string | null; meter: string | null; unit: string | null; unit_size: number | null; price_per_unit: number | null; effective_from: string | null; effective_to: string | null; priority: number | null };
function stringList(value: unknown): string[] { return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : []; }
function unique(left: string[], right: string[]): string[] { return Array.from(new Set([...left, ...right])); }
function currentRule(rule: PricingRule, now = Date.now()): boolean { return (!rule.effective_from || timeValue(rule.effective_from) <= now) && (!rule.effective_to || timeValue(rule.effective_to) > now); }
function perMillion(rule: PricingRule): number | null { const unit = String(rule.unit ?? "").toLowerCase(); const meter = String(rule.meter ?? "").toLowerCase(); const price = Number(rule.price_per_unit); const size = Number(rule.unit_size ?? 1); return (unit === "token" || unit === "pixel" || meter.includes("pixel")) && Number.isFinite(price) && Number.isFinite(size) && size > 0 ? price / size * 1_000_000 : null; }
function basicUnit(rule: PricingRule): string | null { const unit = String(rule.unit ?? "").toLowerCase(); const meter = String(rule.meter ?? "").toLowerCase(); const size = Number(rule.unit_size ?? 1); if (unit === "token") return "1M tokens"; if (unit === "pixel" || meter.includes("pixel")) return "1M pixels"; if (!unit) return null; return Number.isFinite(size) && size > 1 ? `${size} ${unit}s` : unit; }
function meterLabel(value: string): string { const labels: Record<string, string> = { input_tokens: "Input Tokens", input_text_tokens: "Input Text Tokens", output_tokens: "Output Tokens", output_text_tokens: "Output Text Tokens", output_reasoning_tokens: "Output Reasoning Tokens", cached_read_text_tokens: "Cache Read Tokens", cached_write_text_tokens: "Cache Write Tokens", cached_write_text_tokens_5m: "Cache Write Tokens (5 Min TTL)", cached_write_text_tokens_1h: "Cache Write Tokens (1 Hour TTL)", image_pixels: "Image Pixels", video_pixels: "Video Pixels", output_image: "Output Images", output_video_seconds: "Output Video Seconds", requests: "Requests", total_tokens: "Total Tokens" }; return labels[value] ?? value.split("_").filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(" "); }
function comparable(rule: PricingRule): number | null { const price = Number(rule.price_per_unit); const size = Number(rule.unit_size ?? 1); return Number.isFinite(price) && Number.isFinite(size) && size > 0 ? price / size : null; }
function pricingMeter(rule: PricingRule) { const meter = String(rule.meter ?? "").trim().toLowerCase(); const unit = String(rule.unit ?? "unit").trim().toLowerCase() || "unit"; const size = Number(rule.unit_size ?? 1); const unitSize = Number.isFinite(size) && size > 0 ? size : 1; const price = Number(rule.price_per_unit); if (!meter || !Number.isFinite(price)) return null; const million = perMillion(rule); return { meter, label: meterLabel(meter), unit, unit_size: unitSize, price_per_unit_usd: price, price_per_1m_usd: million, estimated_price_per_image_usd: meter === "image_pixels" ? price / unitSize * 1024 * 1024 : null, display_unit_label: basicUnit(rule) ?? unit }; }

function unknownApp(appId: string, title: unknown): boolean {
	const id = appId.trim().toLowerCase();
	const name = String(title ?? "").trim().toLowerCase();
	return !id || ["unknown", "unknown-app", "unknown_app"].includes(id) || ["unknown", "unknown app"].includes(name);
}

function modality(value: string): Modality | null { const normalized = value.toLowerCase().replace(/[._/-]+/g, " "); if (normalized.includes("text")) return "text"; if (normalized.includes("image")) return "image"; if (normalized.includes("video")) return "video"; if (normalized.includes("audio") || normalized.includes("music")) return "audio"; if (normalized.includes("moderat")) return "moderation"; if (normalized.includes("embed")) return "embedding"; return null; }
function emptyModalities() { return Object.fromEntries(MODALITIES.map((key) => [key, { input: [] as string[], output: [] as string[] }])) as Variant["modalities"]; }
function latest(values: Array<string | null>): string | null { return values.filter((value): value is string => Boolean(value)).sort((a, b) => timeValue(b) - timeValue(a))[0] ?? null; }

function providerCards(variants: Variant[]) {
	const byId = new Map(variants.map((variant) => [variant.id, variant])); const groups = new Map<string, Variant[]>();
	for (const variant of variants) {
		let key = variant.id;
		if (variant.offerScope === "regional") {
			for (const suffix of ["-eu", "-us"]) { if (variant.id.endsWith(suffix) && byId.has(variant.id.slice(0, -suffix.length))) key = variant.id.slice(0, -suffix.length); }
			if (key === variant.id && variant.family) {
				const siblings = variants.filter((item) => item.id !== variant.id && item.family === variant.family && item.offerScope !== "regional");
				const label = String(variant.offerLabel ?? "").toLowerCase(); const matching = label ? siblings.filter((item) => item.offerLabel && label.startsWith(item.offerLabel.toLowerCase())) : [];
				key = matching.length === 1 ? matching[0].id : siblings.find((item) => item.offerScope === "global")?.id ?? (siblings.length === 1 ? siblings[0].id : key);
			}
		}
		groups.set(key, [...(groups.get(key) ?? []), variant]);
	}
	const totalDailyRequests = variants.reduce((sum, item) => sum + Math.max(0, item.dailyRequests), 0);
	return Array.from(groups.entries()).map(([key, group]) => {
		const representative = group.find((item) => item.id === key) ?? [...group].sort((a, b) => (a.offerScope === "global" ? 0 : 1) - (b.offerScope === "global" ? 0 : 1) || a.id.localeCompare(b.id))[0];
		const modalitySupport = Object.fromEntries(MODALITIES.map((name) => [name, { input: new Set(group.flatMap((item) => item.modalities[name].input)).size, output: new Set(group.flatMap((item) => item.modalities[name].output)).size }]));
		const groupRequests = group.reduce((sum, item) => sum + Math.max(0, item.dailyRequests), 0);
		return { api_provider_id: representative.id, api_provider_name: ["anthropic-aws", "anthropic-aws-us"].includes(representative.id) ? "Anthropic on AWS" : representative.name, colour: representative.colour, country_code: representative.country, is_gateway_provider: group.some((item) => item.isGatewayProvider), prompt_training_policy: representative.promptTrainingPolicy, data_policy_tier: representative.dataPolicyTier, zero_data_retention: representative.zeroDataRetention, data_retention_days: representative.dataRetentionDays, privacy_policy_url: representative.privacyPolicyUrl, terms_of_service_url: representative.termsOfServiceUrl, last_updated_at: latest(group.map((item) => item.updatedAt)), total_models: new Set(group.flatMap((item) => item.totalIds)).size, active_models: new Set(group.flatMap((item) => item.activeIds)).size, free_models: new Set(group.flatMap((item) => item.freeIds)).size, total_daily_tokens: group.reduce((sum, item) => sum + Math.max(0, item.dailyTokens), 0), total_monthly_tokens: group.reduce((sum, item) => sum + Math.max(0, item.monthlyTokens), 0), daily_share_pct: totalDailyRequests ? groupRequests / totalDailyRequests * 100 : 0, modality_support: modalitySupport };
	});
}

async function providerIndex(env: Env) {
	const rows = await listProviderIndexRows(env) as ProviderIndexRpcRow[];
	const variants: Variant[] = rows.map((row) => ({
		id: row.provider_slug,
		name: row.provider_name,
		colour: row.colour,
		country: row.country_code ?? "",
		family: row.provider_family_id,
		offerLabel: row.offer_label,
		offerScope: row.offer_scope,
		isGatewayProvider: row.is_gateway_provider,
		promptTrainingPolicy: row.prompt_training_policy,
		dataPolicyTier: row.data_policy_tier,
		zeroDataRetention: row.zero_data_retention,
		dataRetentionDays: row.data_retention_days,
		privacyPolicyUrl: row.privacy_policy_url,
		termsOfServiceUrl: row.terms_of_service_url,
		totalIds: row.total_model_ids ?? [],
		activeIds: row.active_model_ids ?? [],
		freeIds: row.free_model_ids ?? [],
		dailyRequests: numeric(row.requests_24h),
		dailyTokens: numeric(row.tokens_24h),
		monthlyTokens: numeric(row.tokens_30d),
		updatedAt: row.last_updated_at,
		modalities: {
			text: { input: row.text_input_model_ids ?? [], output: row.text_output_model_ids ?? [] },
			image: { input: row.image_input_model_ids ?? [], output: row.image_output_model_ids ?? [] },
			video: { input: row.video_input_model_ids ?? [], output: row.video_output_model_ids ?? [] },
			audio: { input: row.audio_input_model_ids ?? [], output: row.audio_output_model_ids ?? [] },
			moderation: { input: row.moderation_input_model_ids ?? [], output: row.moderation_output_model_ids ?? [] },
			embedding: { input: row.embedding_input_model_ids ?? [], output: row.embedding_output_model_ids ?? [] },
		},
	}));
	return providerCards(variants);
}

type RecentModel = {
	model_id: string;
	api_model_id: string;
	created_at: string;
	is_active_gateway: boolean;
	data_models?: Record<string, unknown> | null;
};

type NumericValue = number | string | null;
type RollupRow = { bucket_15m: string; canonical_model_id: string | null; app_id?: string | null; requests: NumericValue; success_requests: NumericValue; total_tokens: NumericValue; latency_sum_ms: NumericValue; latency_samples: NumericValue; throughput_sum: NumericValue; throughput_samples: NumericValue };
type Aggregate = { requests: number; successRequests: number; totalTokens: number; latencySum: number; latencySamples: number; throughputSum: number; throughputSamples: number };

function emptyAggregate(): Aggregate { return { requests: 0, successRequests: 0, totalTokens: 0, latencySum: 0, latencySamples: 0, throughputSum: 0, throughputSamples: 0 }; }
function numeric(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function average(sum: number, samples: number): number | null { return Number.isFinite(sum) && Number.isFinite(samples) && samples > 0 ? sum / samples : null; }
function dayBucket(value: Date): string { const date = new Date(value); date.setUTCHours(0, 0, 0, 0); return date.toISOString(); }
function mergeAggregate(target: Aggregate, row: RollupRow) {
	target.requests += numeric(row.requests); target.successRequests += numeric(row.success_requests); target.totalTokens += numeric(row.total_tokens);
	target.latencySum += numeric(row.latency_sum_ms); target.latencySamples += numeric(row.latency_samples);
	target.throughputSum += numeric(row.throughput_sum); target.throughputSamples += numeric(row.throughput_samples);
}

async function providerRollups(env: Env, providerId: string, hours: number, now: Date): Promise<RollupRow[]> {
	const fromIso = new Date(now.getTime() - hours * 3_600_000).toISOString();
	return listProviderRollups(env, providerId, fromIso, now.toISOString()) as Promise<RollupRow[]>;
}

function metricLeaders(stats: Map<string, Aggregate> | undefined, labels: Map<string, string>, metric: "throughput" | "latency", limit = 5) {
	if (!stats) return [];
	return Array.from(stats.entries()).map(([id, values]) => ({
		id, label: labels.get(id) ?? id, requests: values.requests,
		value: metric === "throughput" ? average(values.throughputSum, values.throughputSamples) : average(values.latencySum, values.latencySamples),
	})).filter((row) => row.value != null).sort((left, right) => metric === "throughput"
		? Number(right.value) - Number(left.value) || right.requests - left.requests || left.label.localeCompare(right.label)
		: Number(left.value) - Number(right.value) || right.requests - left.requests || left.label.localeCompare(right.label)).slice(0, limit);
}

async function buildProviderMetrics(env: Env, providerId: string, hours: number) {
	const now = new Date();
	const rows = await providerRollups(env, providerId, hours, now);
	const empty = { summary: { uptimePct: null, avgLatencyMs: null, avgThroughput: null, avgGenerationMs: null, requests24h: 0, successful24h: 0 }, timeseries: { latency: [], throughput: [] }, dailyModelLeaderboards: {} };
	if (!rows.length) return empty;
	const modelIds = Array.from(new Set(rows.map((row) => String(row.canonical_model_id ?? "").trim()).filter(Boolean)));
	const labels = await getProviderModelNames(env, modelIds);
	const totals = emptyAggregate();
	const days = new Map<string, Aggregate>();
	const dayModels = new Map<string, Map<string, Aggregate>>();
	for (const row of rows) {
		const date = new Date(row.bucket_15m); if (!Number.isFinite(date.getTime())) continue;
		const key = dayBucket(date); const day = days.get(key) ?? emptyAggregate(); mergeAggregate(day, row); days.set(key, day); mergeAggregate(totals, row);
		const modelId = String(row.canonical_model_id ?? "").trim(); if (!modelId) continue;
		const models = dayModels.get(key) ?? new Map<string, Aggregate>(); const model = models.get(modelId) ?? emptyAggregate(); mergeAggregate(model, row); models.set(modelId, model); dayModels.set(key, models);
	}
	const points: Array<Record<string, unknown>> = [];
	const dailyModelLeaderboards: Record<string, unknown> = {};
	for (let cursor = new Date(now.getTime() - hours * 3_600_000); cursor <= now; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
		const key = dayBucket(cursor); const values = days.get(key) ?? emptyAggregate();
		points.push({ timestamp: key, requests: values.requests, uptimePct: values.requests ? values.successRequests / values.requests * 100 : null, avgLatencyMs: average(values.latencySum, values.latencySamples), avgThroughput: average(values.throughputSum, values.throughputSamples), avgGenerationMs: null });
		const modelStats = dayModels.get(key); const latency = metricLeaders(modelStats, labels, "latency");
		dailyModelLeaderboards[key] = { throughput: metricLeaders(modelStats, labels, "throughput"), latency, e2e: latency };
	}
	return {
		summary: { uptimePct: totals.requests ? totals.successRequests / totals.requests * 100 : null, avgLatencyMs: average(totals.latencySum, totals.latencySamples), avgThroughput: average(totals.throughputSum, totals.throughputSamples), avgGenerationMs: null, requests24h: totals.requests, successful24h: totals.successRequests },
		timeseries: { latency: points, throughput: points }, dailyModelLeaderboards,
	};
}

function calendarDays(days: number) {
	const now = new Date();
	const since = new Date(now); since.setUTCDate(since.getUTCDate() - (days - 1)); since.setUTCHours(0, 0, 0, 0);
	const buckets = Array.from({ length: days }, (_, index) => { const date = new Date(since); date.setUTCDate(date.getUTCDate() + index); return date.toISOString().slice(0, 10); });
	return { now, since, buckets, bucketSet: new Set(buckets) };
}

async function tokenRollups(args: { env: Env; providerId: string; idColumn: "canonical_model_id" | "app_id"; ids?: string[]; since: string; to: string; maxPages: number }) {
	if (args.ids && !args.ids.length) return [];
	const rows = await listProviderRollups(args.env, args.providerId, args.since, args.to);
	return rows.filter((row) => !args.ids?.length || args.ids.includes(String(args.idColumn === "canonical_model_id" ? row.canonical_model_id : row.app_id)));
}

async function modelTokenSeries(env: Env, providerId: string, days: number, topLimit: number) {
	const window = calendarDays(days);
	const topRows = await listProviderTopModels(env, providerId, window.since.toISOString(), Math.min(100, Math.max(topLimit * 5, topLimit)));
	const preferred = topRows.map((row) => String(row.model_id ?? "").trim()).filter(Boolean);
	let rows = await tokenRollups({ env, providerId, idColumn: "canonical_model_id", ids: preferred, since: window.since.toISOString(), to: window.now.toISOString(), maxPages: 8 });
	if (!rows.length) rows = await tokenRollups({ env, providerId, idColumn: "canonical_model_id", since: window.since.toISOString(), to: window.now.toISOString(), maxPages: 4 });
	const totals = new Map<string, number>(); const daily = new Map<string, Map<string, number>>();
	for (const row of rows) {
		const id = String(row.canonical_model_id ?? "").trim(); const tokens = Number(row.total_tokens ?? 0); const day = new Date(String(row.bucket_15m)).toISOString().slice(0, 10);
		if (!id || !Number.isFinite(tokens) || tokens <= 0 || !window.bucketSet.has(day)) continue;
		totals.set(id, (totals.get(id) ?? 0) + tokens); const values = daily.get(day) ?? new Map<string, number>(); values.set(id, (values.get(id) ?? 0) + tokens); daily.set(day, values);
	}
	const ids = Array.from(totals.entries()).sort((left, right) => right[1] - left[1]).slice(0, topLimit).map(([id]) => id);
	const names = await getProviderModelNames(env, ids);
	const models = ids.map((modelId) => ({ modelId, modelName: names.get(modelId) ?? modelId, totalTokens: Math.round(totals.get(modelId) ?? 0) }));
	return { models, points: window.buckets.flatMap((bucket) => models.map((model) => ({ bucket, modelId: model.modelId, tokens: Math.round(daily.get(bucket)?.get(model.modelId) ?? 0) }))) };
}

async function appTokenSeries(env: Env, providerId: string, days: number, topLimit: number) {
	const window = calendarDays(days); const period = days <= 1 ? "day" : days <= 7 ? "week" : "month"; const periodDays = period === "month" ? 30 : period === "week" ? 7 : 1;
	const topRows = (await listProviderTopApps(env, providerId, new Date(Date.now() - periodDays * 86_400_000).toISOString(), Math.max(topLimit * 5, topLimit))).filter((row) => !unknownApp(String(row.app_id ?? ""), row.title));
	const preferred = topRows.map((row) => String(row.app_id ?? "").trim()).filter(Boolean);
	let rows = await tokenRollups({ env, providerId, idColumn: "app_id", ids: preferred, since: window.since.toISOString(), to: window.now.toISOString(), maxPages: 8 });
	if (!rows.length) rows = await tokenRollups({ env, providerId, idColumn: "app_id", since: window.since.toISOString(), to: window.now.toISOString(), maxPages: 4 });
	const totals = new Map<string, number>(); const daily = new Map<string, Map<string, number>>();
	for (const row of rows) {
		const id = String(row.app_id ?? "").trim(); const tokens = Number(row.total_tokens ?? 0); const day = new Date(String(row.bucket_15m)).toISOString().slice(0, 10);
		if (!id || !Number.isFinite(tokens) || tokens <= 0 || !window.bucketSet.has(day)) continue;
		totals.set(id, (totals.get(id) ?? 0) + tokens); const values = daily.get(day) ?? new Map<string, number>(); values.set(id, (values.get(id) ?? 0) + tokens); daily.set(day, values);
	}
	const ids = Array.from(totals.entries()).sort((left, right) => right[1] - left[1]).slice(0, topLimit).map(([id]) => id);
	const meta = await getProviderAppMetadata(env, ids); const topMeta = new Map(topRows.map((row) => [String(row.app_id), row]));
	const apps = ids.filter((appId) => meta.has(appId)).map((appId) => {
		const primary = topMeta.get(appId) as Record<string, unknown> | undefined; const fallback = meta.get(appId); const title = String(primary?.title ?? fallback?.title ?? appId).trim() || appId;
		const primaryUrl = typeof primary?.url === "string" ? primary.url : null;
		return unknownApp(appId, title) ? null : { appId, title, url: primaryUrl ?? fallback?.url ?? null, imageUrl: fallback?.image_url ?? null, totalTokens: Math.round(totals.get(appId) ?? 0) };
	}).filter((app): app is NonNullable<typeof app> => Boolean(app));
	return { apps, points: window.buckets.flatMap((bucket) => apps.map((app) => ({ bucket, appId: app.appId, tokens: Math.round(daily.get(bucket)?.get(app.appId) ?? 0) }))) };
}

function timeValue(value: unknown): number {
	const parsed = Date.parse(String(value ?? ""));
	return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function lifecycleDate(model: RecentModel): string | null {
	return typeof model.data_models?.release_date === "string"
		? model.data_models.release_date
		: typeof model.data_models?.announcement_date === "string"
			? model.data_models.announcement_date
			: null;
}

async function recentModels(env: Env, providerId: string, since: string | null, limit: number): Promise<RecentModel[]> {
	return listProviderRecentModels(env, providerId, since, limit) as Promise<RecentModel[]>;
}

export const publicProvidersRouter = new Hono<{ Bindings: Env }>();

publicProvidersRouter.get("/", async (c) => {
	try { return withPublicCache(c.json({ providers: await providerIndex(c.env) }), TELEMETRY_CACHE); }
	catch (error) { console.error("[web-api/providers] index failed", error); return c.json({ error: "providers_unavailable" }, 503); }
});

publicProvidersRouter.get("/:providerId/top-models", async (c) => {
	const providerId = c.req.param("providerId");
	const count = boundedInt(c.req.query("count"), 6, 50);
	try {
		const rows = await listProviderTopModels(c.env, providerId, new Date(Date.now() - 86_400_000).toISOString(), count);
		const models = rows.map((row) => ({
			model_id: row.model_id,
			model_name: row.model_name,
			request_count: Number(row.request_count),
			total_tokens: row.total_tokens == null ? null : Number(row.total_tokens),
			median_latency_ms: row.median_latency_ms ? Math.round(Number(row.median_latency_ms)) : null,
			median_throughput: row.median_throughput ? Math.round(Number(row.median_throughput) * 100) / 100 : null,
		}));
		return withPublicCache(c.json({ models }), providerPolicy(TELEMETRY_CACHE, providerId));
	} catch (error) {
		console.error("[web-api/providers] top models failed", { providerId, error });
		return c.json({ error: "provider_top_models_unavailable" }, 503);
	}
});

publicProvidersRouter.get("/:providerId/top-apps", async (c) => {
	const providerId = c.req.param("providerId");
	const period = ["day", "week", "month"].includes(c.req.query("period") ?? "") ? c.req.query("period")! : "day";
	const count = boundedInt(c.req.query("count"), 20, 100);
	const days = period === "month" ? 30 : period === "week" ? 7 : 1;
	try {
		const rows = await listProviderTopApps(c.env, providerId, new Date(Date.now() - days * 86_400_000).toISOString(), count);
		const apps = rows.filter((row) => !unknownApp(row.app_id, row.title)).map((row) => ({ ...row, total_tokens: Number(row.total_tokens) }));
		return withPublicCache(c.json({ apps }), providerPolicy(TELEMETRY_CACHE, providerId));
	} catch (error) {
		console.error("[web-api/providers] top apps failed", { providerId, error });
		return c.json({ error: "provider_top_apps_unavailable" }, 503);
	}
});

publicProvidersRouter.get("/:providerId/updates", async (c) => {
	const providerId = c.req.param("providerId");
	const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
	try {
		const [recent, added, recentTokens] = await Promise.all([
			recentModels(c.env, providerId, null, 5),
			recentModels(c.env, providerId, since, 5),
			getProviderRecentTokens(c.env, providerId, since),
		]);
		return withPublicCache(c.json({ newModels: added, recentModels: recent, recentTokens }), providerPolicy(UPDATES_CACHE, providerId));
	} catch (error) {
		console.error("[web-api/providers] updates failed", { providerId, error });
		return c.json({ error: "provider_updates_unavailable" }, 503);
	}
});

publicProvidersRouter.get("/:providerId/metrics", async (c) => {
	const providerId = c.req.param("providerId");
	const hours = boundedInt(c.req.query("hours"), 24 * 7, 24 * 365);
	try {
		return withPublicCache(c.json(await buildProviderMetrics(c.env, providerId, hours)), providerPolicy(TELEMETRY_CACHE, providerId));
	} catch (error) {
		console.error("[web-api/providers] metrics failed", { providerId, hours, error });
		return c.json({ error: "provider_metrics_unavailable" }, 503);
	}
});

publicProvidersRouter.get("/:providerId/model-token-timeseries", async (c) => {
	const providerId = c.req.param("providerId"); const days = boundedInt(c.req.query("days"), 30, 365); const topModels = boundedInt(c.req.query("topModels"), 8, 50);
	try { return withPublicCache(c.json(await modelTokenSeries(c.env, providerId, days, topModels)), providerPolicy(TELEMETRY_CACHE, providerId)); }
	catch (error) { console.error("[web-api/providers] model series failed", { providerId, error }); return c.json({ error: "provider_model_series_unavailable" }, 503); }
});

publicProvidersRouter.get("/:providerId/app-token-timeseries", async (c) => {
	const providerId = c.req.param("providerId"); const days = boundedInt(c.req.query("days"), 30, 365); const topApps = boundedInt(c.req.query("topApps"), 20, 100);
	try { return withPublicCache(c.json(await appTokenSeries(c.env, providerId, days, topApps)), providerPolicy(TELEMETRY_CACHE, providerId)); }
	catch (error) { console.error("[web-api/providers] app series failed", { providerId, error }); return c.json({ error: "provider_app_series_unavailable" }, 503); }
});

publicProvidersRouter.get("/:providerId/models", async (c) => {
	const providerId = c.req.param("providerId");
	if (["inception", "inceptron", "nextbit"].includes(providerId.toLowerCase())) return withPublicCache(c.json({ models: [] }), providerPolicy(UPDATES_CACHE, providerId));
	try {
		const sources = await loadProviderModelCatalogue(c.env, providerId);
		const providerRows = sources.routes;
		const providerModelIds = providerRows.map((row) => row.provider_model_id).filter((id): id is string => Boolean(id));
		const modelIds = Array.from(new Set(providerRows.map((row) => row.model_slug).filter((id): id is string => Boolean(id))));
		const capsResult = { data: sources.capabilities }; const skusResult = { data: sources.skus }; const metersResult = { data: sources.meters };
		const modelMeta = new Map(providerRows.map((row) => [row.model_slug, { model_slug: row.model_slug, name: row.model.name, released_at: row.model.released_at, announced_at: row.model.announced_at }]));
		const visible = new Set(modelMeta.keys());
		const capabilities = new Map<string, string[]>(); const params = new Map<string, string[]>();
		for (const cap of capsResult.data ?? []) {
			if (cap.status === "disabled" || !cap.provider_model_id || !cap.capability_id) continue;
			capabilities.set(cap.provider_model_id, unique(capabilities.get(cap.provider_model_id) ?? [], [cap.capability_id]));
			const supported = cap.params && typeof cap.params === "object" && !Array.isArray(cap.params) ? Object.keys(cap.params) : [];
			params.set(cap.provider_model_id, unique(params.get(cap.provider_model_id) ?? [], supported));
		}
		const merged = new Map<string, Record<string, unknown>>(); const routeIds = new Map<string, Set<string>>();
		for (const row of providerRows) {
			if (!row.model_slug || !visible.has(row.model_slug)) continue;
			const modelId = row.model_slug;
			routeIds.set(modelId, new Set([...(routeIds.get(modelId) ?? []), row.provider_model_id]));
			const meta = modelMeta.get(modelId); const endpoints = capabilities.get(row.provider_model_id) ?? []; const supported = params.get(row.provider_model_id) ?? [];
			const existing = merged.get(modelId);
			if (!existing) {
				merged.set(modelId, { model_id: modelId, api_model_id: row.provider_model_slug ?? modelId, model_name: meta?.name ?? row.provider_model_slug ?? modelId, provider_model_slug: row.provider_model_slug ?? null, endpoints, supported_params: supported, is_active_gateway: Boolean(row.routing_enabled && ["active", "degraded"].includes(String(row.status))), input_modalities: stringList(row.input_modalities), output_modalities: stringList(row.output_modalities), release_date: meta?.released_at ?? null, announcement_date: meta?.announced_at ?? null, created_at: row.created_at ?? null });
				continue;
			}
			if (timeValue(row.created_at) > timeValue(existing.created_at)) existing.created_at = row.created_at ?? null;
			existing.endpoints = unique(stringList(existing.endpoints), endpoints); existing.supported_params = unique(stringList(existing.supported_params), supported);
			existing.input_modalities = unique(stringList(existing.input_modalities), stringList(row.input_modalities)); existing.output_modalities = unique(stringList(existing.output_modalities), stringList(row.output_modalities));
			existing.is_active_gateway = Boolean(existing.is_active_gateway || (row.routing_enabled && ["active", "degraded"].includes(String(row.status))));
		}
		const skuById = new Map((skusResult.data ?? []).map((row) => [row.sku_id, row]));
		const rulesByRoute = new Map<string, PricingRule[]>();
		for (const meter of metersResult.data ?? []) {
			const sku = skuById.get(meter.sku_id);
			if (!sku || sku.status === "disabled") continue;
			const nanos = Number(meter.price_nanos); const quantity = Number(meter.unit_quantity ?? 1);
			if (!Number.isFinite(nanos) || !Number.isFinite(quantity) || quantity <= 0) continue;
			const rule: PricingRule = { model_key: sku.provider_model_id, pricing_plan: sku.service_tier_slug ?? "standard", meter: meter.meter_key, unit: meter.unit, unit_size: quantity, price_per_unit: nanos / 1_000_000_000, effective_from: sku.effective_from, effective_to: sku.effective_to, priority: Number(meter.meter_order ?? 100) };
			if (!currentRule(rule)) continue;
			rulesByRoute.set(sku.provider_model_id, [...(rulesByRoute.get(sku.provider_model_id) ?? []), rule]);
		}
		const meterOrder = new Map(["input_text_tokens", "output_text_tokens", "cached_read_text_tokens", "cached_write_text_tokens", "cached_write_text_tokens_5m", "cached_write_text_tokens_1h", "total_tokens", "image_pixels", "video_pixels", "output_image", "input_image", "output_video_seconds", "input_video_seconds", "requests"].map((meter, index) => [meter, index]));
		const results = Array.from(merged.values());
		for (const model of results) {
			const ids = routeIds.get(String(model.model_id)) ?? new Set<string>(); const matches = Array.from(ids).flatMap((id) => rulesByRoute.get(id) ?? []); if (!matches.length) continue;
			const standard = matches.filter((rule) => String(rule.pricing_plan ?? "standard").toLowerCase() === "standard"); const effective = standard.length ? standard : matches;
			const sorted = [...effective].sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0) || timeValue(b.effective_from) - timeValue(a.effective_from));
			const input = effective.filter((rule) => String(rule.meter ?? "").toLowerCase().startsWith("input") && String(rule.meter ?? "").toLowerCase().includes("token")).map(perMillion).filter((value): value is number => value != null);
			const output = effective.filter((rule) => String(rule.meter ?? "").toLowerCase().startsWith("output") && String(rule.meter ?? "").toLowerCase().includes("token")).map(perMillion).filter((value): value is number => value != null);
			const byMeter = new Map<string, PricingRule>(); for (const rule of sorted) { const meter = String(rule.meter ?? "").toLowerCase().trim(); if (!meter) continue; const current = byMeter.get(meter); if (!current || (comparable(rule) != null && (comparable(current) == null || comparable(rule)! < comparable(current)!))) byMeter.set(meter, rule); }
			const meters = Array.from(byMeter.values()).map(pricingMeter).filter((meter): meter is NonNullable<typeof meter> => Boolean(meter)).sort((a, b) => (meterOrder.get(a.meter) ?? 999) - (meterOrder.get(b.meter) ?? 999) || a.label.localeCompare(b.label));
			const baseline = sorted[0]; model.input_price_per_1m_usd = input.length ? Math.min(...input) : null; model.output_price_per_1m_usd = output.length ? Math.min(...output) : null; model.starting_price_usd = baseline && Number.isFinite(Number(baseline.price_per_unit)) ? Number(baseline.price_per_unit) : null; model.starting_price_unit = baseline ? basicUnit(baseline) : null; model.pricing_meters = meters.length ? meters : null;
		}
		results.sort((a, b) => timeValue(b.release_date ?? b.announcement_date) - timeValue(a.release_date ?? a.announcement_date) || timeValue(b.created_at) - timeValue(a.created_at) || String(a.model_name ?? a.model_id).localeCompare(String(b.model_name ?? b.model_id)));
		return withPublicCache(c.json({ models: results }), providerPolicy(UPDATES_CACHE, providerId));
	} catch (error) {
		console.error("[web-api/providers] models failed", { providerId, error });
		return c.json({ error: "provider_models_unavailable" }, 503);
	}
});
