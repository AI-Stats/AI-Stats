import { Hono } from "hono";
import { getDataClient } from "@/data/supabase";
import type { Env } from "@/env";
import { withPublicCache } from "@/http/cache";

const LIVE_CACHE = { edgeTtlSeconds: 15 * 60, staleWhileRevalidateSeconds: 15 * 60, cacheTags: ["web-api-rankings"] } as const;
const META_CACHE = { edgeTtlSeconds: 60 * 60, staleWhileRevalidateSeconds: 24 * 60 * 60, cacheTags: ["web-api-ranking-metadata"] } as const;

function bounded(value: string | undefined, fallback: number, max: number) {
	const parsed = Math.round(Number(value));
	return Number.isFinite(parsed) ? Math.max(1, Math.min(max, parsed)) : fallback;
}

function csv(value: string | undefined, max = 500) {
	return [...new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean))].slice(0, max);
}

export const publicRankingsRouter = new Hono<{ Bindings: Env }>();

publicRankingsRouter.get("/rankings/performance", async (c) => {
	try { const { data, error } = await getDataClient(c.env).rpc("get_public_model_performance", { p_hours: bounded(c.req.query("hours"), 24, 24 * 30) }); if (error) throw error; return withPublicCache(c.json({ data: data ?? [] }), LIVE_CACHE); }
	catch (error) { console.error("[web-api/rankings] performance failed", error); return c.json({ error: "ranking_performance_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/market-share", async (c) => {
	const dimension = c.req.query("dimension") === "provider" ? "provider" : "organization";
	try { const { data, error } = await getDataClient(c.env).rpc("get_public_market_share", { p_dimension: dimension, p_time_range: c.req.query("time_range") || "week" }); if (error) throw error; return withPublicCache(c.json({ data: data ?? [] }), LIVE_CACHE); }
	catch (error) { console.error("[web-api/rankings] market share failed", error); return c.json({ error: "market_share_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/market-share-timeseries", async (c) => {
	const dimension = c.req.query("dimension") === "provider" ? "provider" : "organization";
	try { const { data, error } = await getDataClient(c.env).rpc("get_public_market_share_timeseries", { p_dimension: dimension, p_time_range: c.req.query("time_range") || "week", p_bucket_size: c.req.query("bucket_size") || "day", p_top_n: bounded(c.req.query("top_n"), 8, 100) }); if (error) throw error; return withPublicCache(c.json({ data: data ?? [] }), LIVE_CACHE); }
	catch (error) { console.error("[web-api/rankings] market share series failed", error); return c.json({ error: "market_share_timeseries_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/timeseries", async (c) => {
	try { const { data, error } = await getDataClient(c.env).rpc("get_public_usage_timeseries", { p_time_range: c.req.query("time_range") || "week", p_bucket_size: c.req.query("bucket_size") || "hour", p_top_n: bounded(c.req.query("top_n"), 10, 100) }); if (error) throw error; return withPublicCache(c.json({ data: data ?? [] }), LIVE_CACHE); }
	catch (error) { console.error("[web-api/rankings] timeseries failed", error); return c.json({ error: "ranking_timeseries_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/multimodal", async (c) => {
	try { const { data, error } = await getDataClient(c.env).rpc("get_public_multimodal_breakdown", { p_time_range: c.req.query("time_range") || "week" }); if (error) throw error; return withPublicCache(c.json({ data: data ?? [] }), LIVE_CACHE); }
	catch (error) { console.error("[web-api/rankings] multimodal failed", error); return c.json({ error: "ranking_multimodal_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/modality-timeseries", async (c) => {
	try { const { data, error } = await getDataClient(c.env).rpc("get_public_modality_usage_timeseries", { p_metric: c.req.query("metric") || "tokens", p_time_range: c.req.query("time_range") || "year", p_top_n: 20 }); if (error) throw error; return withPublicCache(c.json({ data: data ?? [] }), LIVE_CACHE); }
	catch (error) { console.error("[web-api/rankings] modality series failed", error); return c.json({ error: "modality_timeseries_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/unique-users", async (c) => {
	try { const { data, error } = await getDataClient(c.env).rpc("get_public_unique_user_timeseries", { p_time_range: c.req.query("time_range") || "year", p_bucket_size: c.req.query("bucket_size") || "week", p_top_n: bounded(c.req.query("top_n"), 10, 100) }); if (error) throw error; return withPublicCache(c.json({ data: data ?? [] }), LIVE_CACHE); }
	catch (error) { console.error("[web-api/rankings] unique users failed", error); return c.json({ error: "unique_users_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/models", async (c) => {
	try {
		const client = getDataClient(c.env);
		const [rankings, trending, summary] = await Promise.all([
			client.rpc("get_public_model_rankings", { p_time_range: c.req.query("time_range") || "week", p_metric: c.req.query("metric") || "tokens", p_limit: bounded(c.req.query("limit"), 50, 250) }),
			client.rpc("get_public_trending_models", { p_limit: 20 }),
			client.rpc("get_public_summary_stats"),
		]);
		if (rankings.error) throw rankings.error;
		if (trending.error) throw trending.error;
		if (summary.error) throw summary.error;
		const summaryRow = Array.isArray(summary.data) ? summary.data[0] : summary.data;
		return withPublicCache(c.json({ ok: true, rankings: rankings.data ?? [], trending: trending.data ?? [], summary: summaryRow ?? {} }), LIVE_CACHE);
	} catch (error) { console.error("[web-api/rankings] models failed", error); return c.json({ error: "model_rankings_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/provider-meta", async (c) => {
	const ids = csv(c.req.query("ids"));
	try { if (!ids.length) return withPublicCache(c.json({ providers: {} }), META_CACHE); const { data, error } = await getDataClient(c.env).from("v2_providers").select("provider_slug,name,metadata").in("provider_slug", ids); if (error) throw error; const providers = Object.fromEntries((data ?? []).map((row) => [row.provider_slug, { name: row.name ?? row.provider_slug, colour: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>).colour ?? null : null }])); return withPublicCache(c.json({ providers }), META_CACHE); }
	catch (error) { console.error("[web-api/rankings] provider metadata failed", error); return c.json({ error: "provider_metadata_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/organisation-logo-ids", async (c) => {
	const names = csv(c.req.query("names"));
	try { if (!names.length) return withPublicCache(c.json({ organisations: {} }), META_CACHE); const client = getDataClient(c.env); const [byName, byId] = await Promise.all([client.from("v2_labs").select("lab_slug,name").in("name", names), client.from("v2_labs").select("lab_slug").in("lab_slug", names)]); if (byName.error) throw byName.error; if (byId.error) throw byId.error; const organisations: Record<string, string> = {}; for (const row of byName.data ?? []) if (row.name && row.lab_slug) organisations[row.name] = row.lab_slug; for (const row of byId.data ?? []) if (row.lab_slug) organisations[row.lab_slug] = row.lab_slug; return withPublicCache(c.json({ organisations }), META_CACHE); }
	catch (error) { console.error("[web-api/rankings] organisation metadata failed", error); return c.json({ error: "organisation_metadata_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/model-meta", async (c) => {
	const ids = csv(c.req.query("ids"));
	try {
		if (!ids.length) return withPublicCache(c.json({ models: {} }), META_CACHE);
		const client = getDataClient(c.env);
		const toMeta = (row: Record<string, any>) => { const lab = Array.isArray(row.lab) ? row.lab[0] : row.lab; const details = lab?.metadata && typeof lab.metadata === "object" && !Array.isArray(lab.metadata) ? lab.metadata : {}; return { model_id: row.model_slug, name: row.name ?? null, organisation_id: row.lab_slug ?? null, organisation_name: lab?.name ?? null, organisation_colour: details.colour ?? null, license: row.license ?? null }; };
		const direct = await client.from("v2_models").select("model_slug,name,lab_slug,license,lab:v2_labs!v2_models_lab_slug_fkey(name,metadata)").in("model_slug", ids).eq("hidden", false);
		if (direct.error) throw direct.error;
		const models: Record<string, ReturnType<typeof toMeta>> = {};
		for (const row of direct.data ?? []) models[row.model_slug] = toMeta(row);
		const unresolved = ids.filter((id) => !models[id]);
		if (unresolved.length) {
			const [byProviderId, bySlug, byAlias] = await Promise.all([
				client.from("v2_model_provider_routes").select("provider_model_id,provider_model_slug,model_slug").in("provider_model_id", unresolved),
				client.from("v2_model_provider_routes").select("provider_model_id,provider_model_slug,model_slug").in("provider_model_slug", unresolved),
				client.from("v2_model_aliases").select("alias_slug,model_slug").in("alias_slug", unresolved).eq("enabled", true),
			]);
			for (const result of [byProviderId, bySlug, byAlias]) if (result.error) throw result.error;
			const aliases = new Map<string, string>();
			for (const row of [...(byProviderId.data ?? []), ...(bySlug.data ?? [])]) for (const alias of [row.provider_model_id, row.provider_model_slug]) if (unresolved.includes(alias) && row.model_slug && !aliases.has(alias)) aliases.set(alias, row.model_slug);
			for (const row of byAlias.data ?? []) if (row.alias_slug && row.model_slug && !aliases.has(row.alias_slug)) aliases.set(row.alias_slug, row.model_slug);
			const canonicalIds = [...new Set(aliases.values())];
			if (canonicalIds.length) { const canonical = await client.from("v2_models").select("model_slug,name,lab_slug,license,lab:v2_labs!v2_models_lab_slug_fkey(name,metadata)").in("model_slug", canonicalIds).eq("hidden", false); if (canonical.error) throw canonical.error; const byId = new Map((canonical.data ?? []).map((row) => [row.model_slug, toMeta(row)])); for (const [alias, id] of aliases) models[alias] = byId.get(id) ?? { model_id: id, name: null, organisation_id: null, organisation_name: null, organisation_colour: null, license: null }; }
		}
		return withPublicCache(c.json({ models }), META_CACHE);
	} catch (error) { console.error("[web-api/rankings] model metadata failed", error); return c.json({ error: "model_metadata_unavailable" }, 503); }
});

publicRankingsRouter.get("/rankings/indexability", async (c) => {
	try {
		const client = getDataClient(c.env);
		const [rankings, performance, usage, apps] = await Promise.all([
			client.rpc("get_public_model_rankings", { p_time_range: "week", p_metric: "tokens", p_limit: 1 }),
			client.rpc("get_public_model_performance", { p_hours: 24 }),
			client.rpc("get_public_usage_timeseries", { p_time_range: "year", p_bucket_size: "week", p_top_n: 1 }),
			client.rpc("get_public_top_apps", { p_time_range: "week", p_limit: 1 }),
		]);
		for (const result of [rankings, performance, usage, apps]) if (result.error) throw result.error;
		const hasLeaderboardData = (rankings.data ?? []).some((row) => row.model_id && !["unknown", "other"].includes(String(row.model_id).toLowerCase()) && Number(row.total_tokens ?? 0) > 0);
		const hasPerformanceData = (performance.data ?? []).some((row) => row.model_id && row.provider && Number(row.median_throughput ?? 0) > 0);
		const hasUsageData = (usage.data ?? []).some((row) => row.model_id && !["unknown", "other"].includes(String(row.model_id).toLowerCase()) && Number(row.tokens ?? 0) > 0);
		const hasAppsData = (apps.data ?? []).some((row) => Number(row.tokens ?? 0) > 0);
		return withPublicCache(c.json({ hasLeaderboardData, hasPerformanceData, hasUsageData, hasAppsData, shouldIndex: hasLeaderboardData || hasPerformanceData || hasUsageData || hasAppsData }), LIVE_CACHE);
	} catch (error) { console.error("[web-api/rankings] indexability failed", error); return c.json({ error: "rankings_indexability_unavailable" }, 503); }
});
