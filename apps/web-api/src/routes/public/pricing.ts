import { Hono } from "hono";
import { getDataClient } from "@/data/supabase";
import type { Env } from "@/env";
import { withPublicCache } from "@/http/cache";

export const publicPricingRouter = new Hono<{ Bindings: Env }>();

publicPricingRouter.get("/pricing/models", async (c) => {
	try {
		const client = getDataClient(c.env); const now = Date.now();
		const active = (row: Record<string, unknown>) => { const from = row.effective_from ? Date.parse(String(row.effective_from)) : Number.NEGATIVE_INFINITY; const to = row.effective_to ? Date.parse(String(row.effective_to)) : Number.POSITIVE_INFINITY; return now >= from && now < to; };
		const providerResult = await client.from("v2_model_provider_routes").select("provider_model_id,provider_slug,provider_model_slug,model_slug,routing_enabled,status,effective_from,effective_to").eq("routing_enabled", true).in("status", ["active", "degraded"]);
		if (providerResult.error) throw providerResult.error;
		const providerRows = ((providerResult.data ?? []) as Array<Record<string, unknown>>).filter(active);
		const routeIds = providerRows.map((row) => String(row.provider_model_id ?? "")).filter(Boolean);
		const modelIds = [...new Set(providerRows.map((row) => String(row.model_slug ?? "")).filter(Boolean))];
		const [modelsResult, skusResult] = await Promise.all([
			modelIds.length ? client.from("v2_models").select("model_slug,name,released_at,announced_at").in("model_slug", modelIds).eq("hidden", false) : Promise.resolve({ data: [], error: null }),
			routeIds.length ? client.from("v2_pricing_skus").select("sku_id,provider_model_id,operation,service_tier_slug,currency,status,effective_from,effective_to,metadata").in("provider_model_id", routeIds).neq("status", "disabled") : Promise.resolve({ data: [], error: null }),
		]);
		if (modelsResult.error) throw modelsResult.error;
		if (skusResult.error) throw skusResult.error;
		const visible = new Map((modelsResult.data ?? []).map((row) => [row.model_slug, row]));
		const routeById = new Map(providerRows.map((row) => [String(row.provider_model_id), row]));
		const skus = ((skusResult.data ?? []) as Array<Record<string, unknown>>).filter(active);
		const skuIds = skus.map((row) => String(row.sku_id));
		const metersResult = skuIds.length ? await client.from("v2_pricing_sku_meters").select("sku_id,meter_key,unit,unit_quantity,price_nanos,metadata").in("sku_id", skuIds) : { data: [], error: null };
		if (metersResult.error) throw metersResult.error;
		const skuById = new Map(skus.map((row) => [String(row.sku_id), row]));
		const result = new Map<string, Record<string, any>>();
		for (const row of metersResult.data ?? []) { const sku = skuById.get(String(row.sku_id)); const route = sku ? routeById.get(String(sku.provider_model_id)) : null; const model = route ? visible.get(String(route.model_slug)) : null; const priceNanos = Number(row.price_nanos); if (!sku || !route || !model || !Number.isFinite(priceNanos)) continue; const provider = String(route.provider_slug); const modelId = String(route.model_slug); const endpoint = String(sku.operation ?? "inference"); const pricingPlan = String(sku.service_tier_slug ?? "standard"); const groupKey = `${provider}:${modelId}:${endpoint}:${pricingPlan}`; const skuMetadata = sku.metadata && typeof sku.metadata === "object" && !Array.isArray(sku.metadata) ? sku.metadata as Record<string, unknown> : {}; const group = result.get(groupKey) ?? { provider, model: modelId, api_model_id: route.provider_model_slug, endpoint, display_name: model.name ?? undefined, release_date: model.released_at ?? null, announcement_date: model.announced_at ?? null, pricing_plan: pricingPlan, meters: [] }; const meter = { meter: String(row.meter_key ?? ""), unit: String(row.unit ?? ""), unit_size: Number(row.unit_quantity ?? 1), price_per_unit: String(priceNanos / 1_000_000_000), currency: String(sku.currency ?? "USD"), conditions: Array.isArray(skuMetadata.match) ? skuMetadata.match : [], billing_timestamp_basis: skuMetadata.billing_timestamp_basis ?? "request_start", time_windows: Array.isArray(skuMetadata.time_windows) ? skuMetadata.time_windows : [] }; group.meters.push(meter); result.set(groupKey, group); }
		const models = [...result.values()].sort((a, b) => String(a.provider).localeCompare(String(b.provider)) || String(a.model).localeCompare(String(b.model)) || String(a.endpoint).localeCompare(String(b.endpoint)));
		return withPublicCache(c.json({ models }), { edgeTtlSeconds: 60 * 60, staleWhileRevalidateSeconds: 24 * 60 * 60, cacheTags: ["web-api-pricing-models"] });
	} catch (error) { console.error("[web-api/pricing] models failed", error); return c.json({ error: "pricing_models_unavailable" }, 503); }
});
