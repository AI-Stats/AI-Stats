import { Hono } from "hono";
import type { Env } from "@/env";
import { withPublicCache } from "@/http/cache";
import { listPublicPricingRows } from "@/repositories/pricing";

export const publicPricingRouter = new Hono<{ Bindings: Env }>();

publicPricingRouter.get("/pricing/models", async (c) => {
	try {
		const queryKeys = [...new URL(c.req.url).searchParams.keys()];
		if (queryKeys.some((key) => key !== "model_ids")) {
			return c.json({ error: "unsupported_query_parameter" }, 400);
		}
		const requestedModelIds = [...new Set(
			(c.req.query("model_ids") ?? "")
				.split(",")
				.map((value) => value.trim())
				.filter(Boolean),
		)].slice(0, 100);
		const pricingRows = await listPublicPricingRows(c.env, requestedModelIds);
		const result = new Map<string, Record<string, any>>();
		for (const row of pricingRows) { const priceNanos = Number(row.priceNanos); if (!Number.isFinite(priceNanos)) continue; const provider = row.providerSlug; const modelId = row.modelSlug; const endpoint = row.operation || "inference"; const pricingPlan = row.serviceTierSlug || "standard"; const groupKey = `${provider}:${modelId}:${endpoint}:${pricingPlan}`; const skuMetadata = row.skuMetadata && typeof row.skuMetadata === "object" && !Array.isArray(row.skuMetadata) ? row.skuMetadata as Record<string, unknown> : {}; const group = result.get(groupKey) ?? { provider, model: modelId, api_model_id: row.providerModelSlug, endpoint, display_name: row.modelName || undefined, release_date: row.releasedAt, announcement_date: row.announcedAt, pricing_plan: pricingPlan, meters: [] }; const meter = { meter: row.meterKey, unit: row.unit, unit_size: Number(row.unitQuantity), price_per_unit: String(priceNanos / 1_000_000_000), currency: row.currency || "USD", conditions: Array.isArray(skuMetadata.match) ? skuMetadata.match : [], billing_timestamp_basis: skuMetadata.billing_timestamp_basis ?? "request_start", time_windows: Array.isArray(skuMetadata.time_windows) ? skuMetadata.time_windows : [] }; group.meters.push(meter); result.set(groupKey, group); }
		const models = [...result.values()].sort((a, b) => String(a.provider).localeCompare(String(b.provider)) || String(a.model).localeCompare(String(b.model)) || String(a.endpoint).localeCompare(String(b.endpoint)));
		return withPublicCache(c.json({ models }), { edgeTtlSeconds: 60 * 60, staleWhileRevalidateSeconds: 24 * 60 * 60, cacheTags: ["web-api-pricing-models"] });
	} catch (error) { console.error("[web-api/pricing] models failed", error); return c.json({ error: "pricing_models_unavailable" }, 503); }
});
