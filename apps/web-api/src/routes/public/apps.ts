import { Hono } from "hono";
import type { Env } from "@/env";
import { withPublicCache } from "@/http/cache";
import { findPublicApp, getAppUsageSummary, getPublicAppImages, listAppUsage, listProviderModelMappings, listPublicAppIds, listRecentAppRequests, listTopApps, listTrendingApps } from "@/repositories/apps";

type RangeKey = "1h" | "1d" | "1w" | "4w" | "1m" | "1y";
const VALID_RANGES = new Set<RangeKey>(["1h", "1d", "1w", "4w", "1m", "1y"]);

function fromForRange(range: RangeKey): Date {
	const now = new Date();
	const from = new Date(now);
	if (range === "1h") from.setHours(now.getHours() - 1);
	else if (range === "1d") from.setDate(now.getDate() - 1);
	else if (range === "1w") from.setDate(now.getDate() - 7);
	else if (range === "4w") from.setDate(now.getDate() - 28);
	else if (range === "1m") from.setMonth(now.getMonth() - 1);
	else from.setFullYear(now.getFullYear() - 1);
	return from;
}

async function getPublicApp(env: Env, reference: string) {
	return findPublicApp(env, reference) as Promise<Record<string, unknown> | null>;
}

export const publicAppsRouter = new Hono<{ Bindings: Env }>();

publicAppsRouter.get("/apps/ids", async (c) => {
	try {
		const ids = await listPublicAppIds(c.env);
		return withPublicCache(c.json({ ids }), {
			edgeTtlSeconds: 24 * 60 * 60,
			staleWhileRevalidateSeconds: 7 * 24 * 60 * 60,
			cacheTags: ["web-api-apps", "web-api-app-ids"],
		});
	} catch (error) {
		console.error("[web-api/apps] ids failed", error);
		return c.json({ error: "apps_unavailable" }, 503);
	}
});

publicAppsRouter.get("/apps/images", async (c) => {
	const ids = [...new Set((c.req.query("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean))].slice(0, 500);
	try {
		if (ids.length === 0) return withPublicCache(c.json({ images: {} }), { edgeTtlSeconds: 24 * 60 * 60, staleWhileRevalidateSeconds: 7 * 24 * 60 * 60, cacheTags: ["web-api-app-images"] });
		const images = await getPublicAppImages(c.env, ids);
		return withPublicCache(c.json({ images: Object.fromEntries(images) }), { edgeTtlSeconds: 24 * 60 * 60, staleWhileRevalidateSeconds: 7 * 24 * 60 * 60, cacheTags: ["web-api-app-images"] });
	} catch (error) { console.error("[web-api/apps] images failed", error); return c.json({ error: "app_images_unavailable" }, 503); }
});

publicAppsRouter.get("/apps/provider-model-mappings", async (c) => {
	const modelIds = [...new Set((c.req.query("model_ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean))].slice(0, 500);
	const providerIds = [...new Set((c.req.query("provider_ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean))].slice(0, 100);
	try {
		if (modelIds.length === 0) return withPublicCache(c.json({ mappings: [] }), { edgeTtlSeconds: 60 * 60, staleWhileRevalidateSeconds: 24 * 60 * 60, cacheTags: ["web-api-app-model-mappings"] });
		const mappings = await listProviderModelMappings(c.env, modelIds, providerIds);
		return withPublicCache(c.json({ mappings }), { edgeTtlSeconds: 60 * 60, staleWhileRevalidateSeconds: 24 * 60 * 60, cacheTags: ["web-api-app-model-mappings"] });
	} catch (error) { console.error("[web-api/apps] mappings failed", error); return c.json({ error: "app_model_mappings_unavailable" }, 503); }
});

publicAppsRouter.get("/apps/top", async (c) => {
	const timeRange = c.req.query("time_range")?.trim() || "week";
	const limit = Math.max(1, Math.min(100, Math.round(Number(c.req.query("limit")) || 20)));
	try { const rows = await listTopApps(c.env, timeRange, limit); return withPublicCache(c.json({ data: rows }), { edgeTtlSeconds: 15 * 60, staleWhileRevalidateSeconds: 15 * 60, cacheTags: ["web-api-app-rankings"] }); }
	catch (error) { console.error("[web-api/apps] top failed", error); return c.json({ data: [] }, 200, { "Cache-Control": "no-store" }); }
});

publicAppsRouter.get("/apps/trending", async (c) => {
	const limit = Math.max(1, Math.min(100, Math.round(Number(c.req.query("limit")) || 20)));
	const minWeekTokens = Math.max(0, Number(c.req.query("min_week_tokens")) || 0);
	try { const rows = await listTrendingApps(c.env, limit, minWeekTokens); return withPublicCache(c.json({ data: rows }), { edgeTtlSeconds: 15 * 60, staleWhileRevalidateSeconds: 15 * 60, cacheTags: ["web-api-app-rankings"] }); }
	catch (error) { console.error("[web-api/apps] trending failed", error); return c.json({ data: [] }, 200, { "Cache-Control": "no-store" }); }
});

publicAppsRouter.get("/apps/indexability", async (c) => {
	try {
		const [publicIds, topApps, trendingApps] = await Promise.all([
			listPublicAppIds(c.env),
			listTopApps(c.env, "4w", 100),
			listTrendingApps(c.env, 100, 0),
		]);
		const ids = new Set(publicIds);
		const hasLeaderboardData = topApps.some((row) => ids.has(String(row.app_id ?? "")) && Number(row.tokens ?? 0) > 0);
		const hasTrendingData = trendingApps.some((row) => ids.has(String(row.app_id ?? "")) && Number(row.growth_tokens ?? 0) > 0);
		return withPublicCache(c.json({ hasLeaderboardData, hasTrendingData, shouldIndex: hasLeaderboardData || hasTrendingData }), { edgeTtlSeconds: 15 * 60, staleWhileRevalidateSeconds: 15 * 60, cacheTags: ["web-api-app-rankings"] });
	} catch (error) { console.error("[web-api/apps] indexability failed", error); return c.json({ error: "app_indexability_unavailable" }, 503); }
});

publicAppsRouter.get("/apps/:appReference/usage", async (c) => {
	const appReference = c.req.param("appReference");
	const requestedRange = c.req.query("range") as RangeKey | undefined;
	const range = requestedRange && VALID_RANGES.has(requestedRange) ? requestedRange : "4w";
	try {
		const app = await getPublicApp(c.env, appReference);
		if (!app) return c.json({ error: "app_not_found" }, 404);
		const appId = String(app.id ?? "");
		const fromDate = fromForRange(range);
		const from = fromDate.toISOString();
		const nowIso = new Date().toISOString();
		const daily = ["1w", "4w", "1m", "1y"].includes(range);
		const rows = await listAppUsage(c.env, { appId, from, to: nowIso, daily });
		const usage = rows.map((row) => {
				const requests = Number(row.requests ?? 0);
				const successRequests = Number(row.successful_requests ?? 0);
				return {
					created_at: String(row.created_at ?? ""),
					usage: { total_tokens: Number(row.total_tokens ?? 0) || 0 },
					cost_nanos: Number(row.cost_nanos ?? 0) || 0,
					model_id: String(row.model_id ?? ""),
					provider: "",
					success: successRequests > 0,
					requests: Number.isFinite(requests) ? Math.max(0, requests) : 0,
					successful_requests: Number.isFinite(successRequests) ? Math.max(0, successRequests) : 0,
				};
			}).filter((row) => row.created_at && row.model_id);
		return withPublicCache(c.json({ usage }), {
			edgeTtlSeconds: 15 * 60,
			staleWhileRevalidateSeconds: 15 * 60,
			cacheTags: ["web-api-app-usage", `web-api-app-${encodeURIComponent(appId).replace(/%/g, "")}`],
		});
	} catch (error) {
		console.error("[web-api/apps] usage failed", { appReference, range, error });
		return c.json({ error: "app_usage_unavailable" }, 503);
	}
});

publicAppsRouter.get("/apps/:appReference/requests/recent", async (c) => {
	const appReference = c.req.param("appReference");
	const limit = Math.max(1, Math.min(100, Math.round(Number(c.req.query("limit")) || 10)));
	try {
		const app = await getPublicApp(c.env, appReference);
		if (!app) return c.json({ error: "app_not_found" }, 404);
		const appId = String(app.id ?? "");
		const requests = await listRecentAppRequests(c.env, appId, limit);
		return withPublicCache(c.json({ requests }), {
			edgeTtlSeconds: 60,
			staleWhileRevalidateSeconds: 5 * 60,
			cacheTags: ["web-api-app-usage", `web-api-app-${encodeURIComponent(appId).replace(/%/g, "")}`],
		});
	} catch (error) {
		console.error("[web-api/apps] recent requests failed", { appReference, error });
		return c.json({ error: "app_requests_unavailable" }, 503);
	}
});

publicAppsRouter.get("/apps/:appReference", async (c) => {
	const appReference = c.req.param("appReference").trim();
	try {
		const app = await getPublicApp(c.env, appReference);
		if (!app) return c.json({ error: "app_not_found" }, 404);
		const appId = String(app.id ?? "");
		const { totalTokens, totalRequests } = await getAppUsageSummary(c.env, appId);
		return withPublicCache(c.json({ app: {
			...app,
			slug: String(app.slug ?? "").trim(),
			total_tokens: totalTokens,
			total_requests: totalRequests,
		} }), {
			edgeTtlSeconds: 15 * 60,
			staleWhileRevalidateSeconds: 60 * 60,
			cacheTags: ["web-api-apps", `web-api-app-${encodeURIComponent(appId).replace(/%/g, "")}`],
		});
	} catch (error) {
		console.error("[web-api/apps] detail failed", { appReference, error });
		return c.json({ error: "app_unavailable" }, 503);
	}
});
