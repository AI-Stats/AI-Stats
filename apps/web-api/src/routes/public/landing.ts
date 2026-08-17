import { Hono } from "hono";
import type { Env } from "@/env";
import { withPublicCache } from "@/http/cache";
import { getPublicAppImages, listTopApps } from "@/repositories/apps";
import { getLandingGatewayData, getLandingModelStats, getLandingStats, listLandingMainModels } from "@/repositories/landing";

export const publicLandingRouter = new Hono<{ Bindings: Env }>();
function percentile(values: number[], p: number): number | null { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const rank = (sorted.length - 1) * p; const lower = Math.floor(rank), upper = Math.ceil(rank); return lower === upper ? sorted[lower] : sorted[lower] * (upper - rank) + sorted[upper] * (rank - lower); }
function isoHour(date: Date) { const value = new Date(date); value.setUTCMinutes(0, 0, 0); return value.toISOString(); }

publicLandingRouter.get("/landing/stats", async (c) => {
	try { return withPublicCache(c.json(await getLandingStats(c.env)), { edgeTtlSeconds: 3600, staleWhileRevalidateSeconds: 86400, cacheTags: ["web-api-landing", "web-api-landing-stats"] }); }
	catch (error) { console.error("[web-api/landing] stats failed", error); return c.json({ error: "landing_stats_unavailable" }, 503); }
});

publicLandingRouter.get("/landing/gateway-showcase", async (c) => {
	const hours = Math.max(1, Math.min(720, Math.round(Number(c.req.query("hours")) || 720))); const topModelsLimit = Math.max(0, Math.min(25, Math.round(Number(c.req.query("top_models_limit")) || 6))); const topAppsLimit = Math.max(0, Math.min(50, Math.round(Number(c.req.query("top_apps_limit")) || 25)));
	try {
		const [{ rollup, supported, topModels }, topApps] = await Promise.all([getLandingGatewayData(c.env, hours, topModelsLimit), listTopApps(c.env, "week", topAppsLimit)]);
		const now = new Date(), nowMs = now.getTime(); const activeSupported = supported.filter((row) => nowMs >= (row.effective_from ? Date.parse(row.effective_from) : Number.NEGATIVE_INFINITY) && nowMs < (row.effective_to ? Date.parse(row.effective_to) : Number.POSITIVE_INFINITY));
		const byHour = new Map(rollup.map((row) => [isoHour(new Date(String(row.bucket_hour))), row])); const points: Array<Record<string, number | string | null>> = [], latencyAverages: number[] = []; let requests = 0, successful = 0, tokens = 0, latencySum = 0, latencySamples = 0;
		for (let offset = hours - 1; offset >= 0; offset--) { const timestamp = isoHour(new Date(nowMs - offset * 3600000)), row = byHour.get(timestamp); const rowRequests = Number(row?.requests ?? 0), rowSuccessful = Number(row?.success_requests ?? 0), rowTokens = Number(row?.total_tokens ?? 0), rowLatencySum = Number(row?.latency_sum_ms ?? 0), rowLatencySamples = Number(row?.latency_samples ?? 0), averageLatency = rowLatencySamples > 0 ? rowLatencySum / rowLatencySamples : null; requests += rowRequests; successful += rowSuccessful; tokens += rowTokens; latencySum += rowLatencySum; latencySamples += rowLatencySamples; if (averageLatency != null) latencyAverages.push(averageLatency); points.push({ timestamp, requests: rowRequests, uptimePct: rowRequests > 0 ? rowSuccessful / rowRequests * 100 : null, p50Ms: averageLatency, p95Ms: averageLatency, avgMs: averageLatency, requestsPerMin: rowRequests / 60, tokensPerMin: rowTokens / 60, hoursAgo: offset }); }
		const modelIds = [...new Set(activeSupported.map((row) => row.model_slug))], providerIds = [...new Set(activeSupported.map((row) => row.provider_slug))]; const metrics = { summary: { uptimePct: requests > 0 ? successful / requests * 100 : null, latencyP95Ms: percentile(latencyAverages, .95), latencyP50Ms: percentile(latencyAverages, .5), latencyAvgMs: latencySamples > 0 ? latencySum / latencySamples : null, requests24h: requests, successful24h: successful, tokens24h: tokens, requestsPerMinAvg: requests / (hours * 60), supportedModels: modelIds.length || null, supportedProviders: providerIds.length || null }, timeseries: { uptime: points, latency: points, throughput: points }, supported: { modelIds, providerIds }, fallback: requests <= 0 };
		const topRows = topApps.filter((row) => Number(row.tokens ?? 0) > 0 && row.app_id).sort((a, b) => Number(b.tokens ?? 0) - Number(a.tokens ?? 0)).slice(0, 6); const images = await getPublicAppImages(c.env, topRows.map((row) => String(row.app_id))); return withPublicCache(c.json({ appImageUrls: Object.fromEntries(images), metrics, topApps: { data: topApps }, topModels: { data: topModels } }), { edgeTtlSeconds: 900, staleWhileRevalidateSeconds: 900, cacheTags: ["web-api-landing", "web-api-gateway-showcase"] });
	} catch (error) { console.error("[web-api/landing] gateway showcase failed", error); return c.json({ error: "gateway_showcase_unavailable" }, 503); }
});

publicLandingRouter.get("/landing/models/stats", async (c) => { try { return withPublicCache(c.json(await getLandingModelStats(c.env)), { edgeTtlSeconds: 3600, staleWhileRevalidateSeconds: 86400, cacheTags: ["web-api-landing", "web-api-landing-model-stats"] }); } catch (error) { console.error("[web-api/landing] model stats failed", error); return c.json({ error: "model_stats_unavailable" }, 503); } });

publicLandingRouter.get("/landing/models/main", async (c) => { const ids = [...new Set((c.req.query("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean))].slice(0, 25); if (!ids.length) return withPublicCache(c.json({ models: [] }), { edgeTtlSeconds: 86400, staleWhileRevalidateSeconds: 604800, cacheTags: ["web-api-landing", "web-api-landing-main-models"] }); try { return withPublicCache(c.json({ models: await listLandingMainModels(c.env, ids) }), { edgeTtlSeconds: 86400, staleWhileRevalidateSeconds: 604800, cacheTags: ["web-api-landing", "web-api-landing-main-models"] }); } catch (error) { console.error("[web-api/landing] main models failed", error); return c.json({ error: "main_models_unavailable" }, 503); } });
