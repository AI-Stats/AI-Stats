import { Hono } from "hono";
import type { Env } from "@/env";
import { withPublicCache } from "@/http/cache";
import { listTopApps } from "@/repositories/apps";
import {
	getRankingSummary,
	listModelMetadata,
	listOrganisationLogoIds,
	listProviderMetadata,
	loadRankingBenchmarks,
	listContextLengths,
	listFastestModels,
	listGeography,
	listIntelligenceIndex,
	listMarketShare,
	listMarketShareTimeseries,
	listModelPerformance,
	listModelRankings,
	listModalityTimeseries,
	listMultimodalBreakdown,
	listToolCalls,
	listTrendingModels,
	listUniqueUsers,
	listUsageTimeseries,
} from "@/repositories/rankings";

const LIVE_CACHE = { edgeTtlSeconds: 15 * 60, staleWhileRevalidateSeconds: 15 * 60, cacheTags: ["web-api-rankings"] } as const;
const META_CACHE = { edgeTtlSeconds: 60 * 60, staleWhileRevalidateSeconds: 24 * 60 * 60, cacheTags: ["web-api-ranking-metadata"] } as const;

const RANKING_BENCHMARK_IDS = ["aa-intelligence-index-v4"] as const;

function bounded(value: string | undefined, fallback: number, max: number) {
	const parsed = Math.round(Number(value));
	return Number.isFinite(parsed) ? Math.max(1, Math.min(max, parsed)) : fallback;
}

function csv(value: string | undefined, max = 500) {
	return [...new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean))].slice(0, max);
}

export const publicRankingsRouter = new Hono<{ Bindings: Env }>();

publicRankingsRouter.get("/rankings/performance", async (c) => {
	try { const data = await listModelPerformance(c.env, bounded(c.req.query("hours"), 24, 24 * 30)); return withPublicCache(c.json({ data }), LIVE_CACHE); }
	catch (error) { console.error("[web-api/rankings] performance failed", error); return c.json({ error: "ranking_performance_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/fastest-models", async (c) => {
	try {
		const data = await listFastestModels(c.env, bounded(c.req.query("days"), 30, 365), bounded(c.req.query("limit"), 20, 100));
		return withPublicCache(c.json({ data }), LIVE_CACHE);
	} catch (error) {
		console.error("[web-api/rankings] fastest models failed", error);
		return c.json({ error: "ranking_fastest_models_unavailable" }, 503);
	}
});

publicRankingsRouter.get("/rankings/market-share", async (c) => {
	const dimension = c.req.query("dimension") === "provider" ? "provider" : "organization";
	try { const data = await listMarketShare(c.env, dimension, c.req.query("time_range") || "week"); return withPublicCache(c.json({ data }), LIVE_CACHE); }
	catch (error) { console.error("[web-api/rankings] market share failed", error); return c.json({ error: "market_share_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/market-share-timeseries", async (c) => {
	const dimension = c.req.query("dimension") === "provider" ? "provider" : "organization";
	try { const data = await listMarketShareTimeseries(c.env, dimension, c.req.query("time_range") || "week", c.req.query("bucket_size") || "day", bounded(c.req.query("top_n"), 8, 100)); return withPublicCache(c.json({ data }), LIVE_CACHE); }
	catch (error) { console.error("[web-api/rankings] market share series failed", error); return c.json({ error: "market_share_timeseries_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/timeseries", async (c) => {
	try { const data = await listUsageTimeseries(c.env, c.req.query("time_range") || "week", c.req.query("bucket_size") || "hour", bounded(c.req.query("top_n"), 10, 100)); return withPublicCache(c.json({ data }), LIVE_CACHE); }
	catch (error) { console.error("[web-api/rankings] timeseries failed", error); return c.json({ error: "ranking_timeseries_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/multimodal", async (c) => {
	try { const data = await listMultimodalBreakdown(c.env, c.req.query("time_range") || "week"); return withPublicCache(c.json({ data }), LIVE_CACHE); }
	catch (error) { console.error("[web-api/rankings] multimodal failed", error); return c.json({ error: "ranking_multimodal_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/modality-timeseries", async (c) => {
	try { const data = await listModalityTimeseries(c.env, c.req.query("metric") || "tokens", c.req.query("time_range") || "year", 20); return withPublicCache(c.json({ data }), LIVE_CACHE); }
	catch (error) { console.error("[web-api/rankings] modality series failed", error); return c.json({ error: "modality_timeseries_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/text-leaderboard", async (c) => {
	try {
		const data = await listModalityTimeseries(c.env, "text_tokens", c.req.query("time_range") || "year", bounded(c.req.query("top_n"), 20, 100));
		return withPublicCache(c.json({ data }), LIVE_CACHE);
	} catch (error) {
		console.error("[web-api/rankings] text leaderboard failed", error);
		return c.json({ error: "ranking_text_leaderboard_unavailable" }, 503);
	}
});

publicRankingsRouter.get("/rankings/image-inputs", async (c) => {
	try {
		const data = await listModalityTimeseries(c.env, "image_inputs", c.req.query("time_range") || "year", bounded(c.req.query("top_n"), 20, 100));
		return withPublicCache(c.json({ data }), LIVE_CACHE);
	} catch (error) {
		console.error("[web-api/rankings] image inputs failed", error);
		return c.json({ error: "ranking_image_inputs_unavailable" }, 503);
	}
});

publicRankingsRouter.get("/rankings/unique-users", async (c) => {
	try { const data = await listUniqueUsers(c.env, c.req.query("time_range") || "year", c.req.query("bucket_size") || "week", bounded(c.req.query("top_n"), 10, 100)); return withPublicCache(c.json({ data }), LIVE_CACHE); }
	catch (error) { console.error("[web-api/rankings] unique users failed", error); return c.json({ error: "unique_users_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/tool-calls", async (c) => {
	try {
		const data = await listToolCalls(c.env, c.req.query("time_range") || "year", c.req.query("bucket_size") || "week", bounded(c.req.query("top_n"), 10, 100));
		return withPublicCache(c.json({ data }), LIVE_CACHE);
	} catch (error) {
		console.error("[web-api/rankings] tool calls failed", error);
		return c.json({ error: "tool_call_rankings_unavailable" }, 503);
	}
});

publicRankingsRouter.get("/rankings/benchmarks", async (c) => {
	try {
		const source = await loadRankingBenchmarks(c.env, RANKING_BENCHMARK_IDS);
		const models = new Map(source.models.map((row) => {
			return [row.model_slug, {
				model_name: row.name ?? row.model_slug,
				organisation_id: row.lab_slug ?? null,
				organisation_name: row.lab_name ?? row.lab_slug ?? null,
			}];
		}));
		const order = new Map(RANKING_BENCHMARK_IDS.map((id, index) => [id, index]));
		const benchmarks = source.benchmarks
			.sort((left, right) => (order.get(String(left.benchmark_id) as (typeof RANKING_BENCHMARK_IDS)[number]) ?? 99) - (order.get(String(right.benchmark_id) as (typeof RANKING_BENCHMARK_IDS)[number]) ?? 99))
			.map((benchmark) => {
				const lowerIsBetter = benchmark.ascending_order === true;
				const bestByModel = new Map<string, { score: number; rank: number | null }>();
				for (const row of source.scores) {
					const modelSlug = String(row.model_slug ?? "");
					if (row.benchmark_id !== benchmark.benchmark_id || !models.has(modelSlug)) continue;
					const score = Number(row.score_numeric);
					if (!Number.isFinite(score)) continue;
					const previous = bestByModel.get(modelSlug);
					if (!previous || (lowerIsBetter ? score < previous.score : score > previous.score)) {
						bestByModel.set(modelSlug, { score, rank: typeof row.rank === "number" ? row.rank : null });
					}
				}
				const entries = [...bestByModel.entries()]
					.map(([modelId, result]) => ({ model_id: modelId, ...models.get(modelId), ...result }))
					.sort((left, right) => lowerIsBetter ? left.score - right.score : right.score - left.score)
					.map((entry, index) => ({ ...entry, rank: index + 1 }));
				return {
					benchmark_id: benchmark.benchmark_id,
					name: benchmark.name,
					category: benchmark.category,
					benchmark_type: benchmark.benchmark_type,
					lower_is_better: lowerIsBetter,
					total_models: benchmark.total_models,
					entries,
				};
			});
		return withPublicCache(c.json({ benchmarks }), META_CACHE);
	} catch (error) {
		console.error("[web-api/rankings] benchmarks failed", error);
		return c.json({ error: "ranking_benchmarks_unavailable" }, 503);
	}
});


publicRankingsRouter.get("/rankings/intelligence-index", async (c) => {
	try {
		const rows = await listIntelligenceIndex(c.env, bounded(c.req.query("limit"), 20, 100));
		const first = rows[0] ?? null;
		return withPublicCache(c.json({
			benchmark: first ? {
				benchmark_id: first.benchmark_id,
				name: first.benchmark_name,
				category: first.category,
				benchmark_type: first.benchmark_type,
				lower_is_better: false,
				total_models: Number(first.total_models ?? rows.length),
				entries: rows.map((row) => ({
					model_id: row.model_id,
					model_name: row.model_name,
					organisation_id: row.organisation_id,
					organisation_name: row.organisation_name,
					score: Number(row.score),
					rank: Number(row.rank),
				})),
			} : null,
		}), META_CACHE);
	} catch (error) {
		console.error("[web-api/rankings] intelligence index failed", error);
		return c.json({ error: "ranking_intelligence_index_unavailable" }, 503);
	}
});

publicRankingsRouter.get("/rankings/geography", async (c) => {
	const days = bounded(c.req.query("days"), 30, 365);
	const to = new Date();
	const from = new Date(to.getTime() - days * 86_400_000);
	try {
		const data = await listGeography(c.env, from, to);
		return withPublicCache(c.json({ data, days }), LIVE_CACHE);
	} catch (error) {
		console.error("[web-api/rankings] geography failed", error);
		return c.json({ error: "ranking_geography_unavailable" }, 503);
	}
});

publicRankingsRouter.get("/rankings/context-lengths", async (c) => {
	const days = bounded(c.req.query("days"), 30, 365);
	try {
		const data = await listContextLengths(c.env, days);
		return withPublicCache(c.json({ data, days }), LIVE_CACHE);
	} catch (error) {
		console.error("[web-api/rankings] context lengths failed", error);
		return c.json({ error: "ranking_context_lengths_unavailable" }, 503);
	}
});

publicRankingsRouter.get("/rankings/top-apps", async (c) => {
	const timeRange = c.req.query("time_range")?.trim() || "week";
	const limit = bounded(c.req.query("limit"), 20, 100);
	try {
		const data = await listTopApps(c.env, timeRange, limit);
		return withPublicCache(c.json({ data }), LIVE_CACHE);
	} catch (error) {
		console.error("[web-api/rankings] top apps failed", error);
		return c.json({ error: "ranking_top_apps_unavailable" }, 503);
	}
});

publicRankingsRouter.get("/rankings/models", async (c) => {
	try {
		const [rankings, trending, summary] = await Promise.all([
			listModelRankings(c.env, c.req.query("time_range") || "week", c.req.query("metric") || "tokens", bounded(c.req.query("limit"), 50, 250)),
			listTrendingModels(c.env, 20),
			getRankingSummary(c.env),
		]);
		return withPublicCache(c.json({ ok: true, rankings, trending, summary: summary[0] ?? {} }), LIVE_CACHE);
	} catch (error) { console.error("[web-api/rankings] models failed", error); return c.json({ error: "model_rankings_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/provider-meta", async (c) => {
	const ids = csv(c.req.query("ids"));
	try { if (!ids.length) return withPublicCache(c.json({ providers: {} }), META_CACHE); const data = await listProviderMetadata(c.env, ids); const providers = Object.fromEntries(data.map((row) => [row.provider_slug, { name: row.name ?? row.provider_slug, colour: row.colour ?? null }])); return withPublicCache(c.json({ providers }), META_CACHE); }
	catch (error) { console.error("[web-api/rankings] provider metadata failed", error); return c.json({ error: "provider_metadata_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/organisation-logo-ids", async (c) => {
	const names = csv(c.req.query("names"));
	try { if (!names.length) return withPublicCache(c.json({ organisations: {} }), META_CACHE); const data = await listOrganisationLogoIds(c.env, names); const organisations: Record<string, string> = {}; for (const row of data) { if (row.name && row.lab_slug) organisations[String(row.name)] = String(row.lab_slug); if (row.lab_slug) organisations[String(row.lab_slug)] = String(row.lab_slug); } return withPublicCache(c.json({ organisations }), META_CACHE); }
	catch (error) { console.error("[web-api/rankings] organisation metadata failed", error); return c.json({ error: "organisation_metadata_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/model-meta", async (c) => {
	const ids = csv(c.req.query("ids"));
	try {
		if (!ids.length) return withPublicCache(c.json({ models: {} }), META_CACHE);
		const data = await listModelMetadata(c.env, ids);
		const models = Object.fromEntries(data.filter((row) => row.model_id).map((row) => [row.requested_id, { model_id: row.model_id, name: row.name ?? null, organisation_id: row.organisation_id ?? null, organisation_name: row.organisation_name ?? null, organisation_colour: row.organisation_colour ?? null, license: row.license ?? null }]));
		return withPublicCache(c.json({ models }), META_CACHE);
	} catch (error) { console.error("[web-api/rankings] model metadata failed", error); return c.json({ error: "model_metadata_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/indexability", async (c) => {
	try {
		const [rankings, performance, usage, apps] = await Promise.all([
			listModelRankings(c.env, "week", "tokens", 1), listModelPerformance(c.env, 24),
			listUsageTimeseries(c.env, "year", "week", 1), listTopApps(c.env, "week", 1),
		]);
		const hasLeaderboardData = rankings.some((row) => row.model_id && !["unknown", "other"].includes(String(row.model_id).toLowerCase()) && Number(row.total_tokens ?? 0) > 0);
		const hasPerformanceData = performance.some((row) => row.model_id && row.provider && Number(row.median_throughput ?? 0) > 0);
		const hasUsageData = usage.some((row) => row.model_id && !["unknown", "other"].includes(String(row.model_id).toLowerCase()) && Number(row.tokens ?? 0) > 0);
		const hasAppsData = apps.some((row) => Number(row.tokens ?? 0) > 0);
		return withPublicCache(c.json({ hasLeaderboardData, hasPerformanceData, hasUsageData, hasAppsData, shouldIndex: hasLeaderboardData || hasPerformanceData || hasUsageData || hasAppsData }), LIVE_CACHE);
	} catch (error) { console.error("[web-api/rankings] indexability failed", error); return c.json({ error: "rankings_indexability_unavailable" }, 503); }
});
