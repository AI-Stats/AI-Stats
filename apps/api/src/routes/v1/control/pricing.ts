// src/routes/v1/control/pricing.ts
// Purpose: Control-plane route handler for pricing operations.
// Why: Separates admin/control traffic from data-plane requests.
// How: Wires HTTP routes to pipeline entrypoints and response helpers.

import { Hono } from "hono";
import type { Env } from "@/runtime/types";
import { loadPricingCatalogueRows } from "@/repositories/pricing";
import { guardAuth, type GuardErr } from "@pipeline/before/guards";
import { CAPABILITIES } from "@/lib/authz/capabilities";
import { json, withRuntime, cacheHeaders } from "@/routes/utils";
import type { PriceCard } from "@pipeline/pricing/types";
import { requireCapability } from "./route-helpers";

type PricingModel = {
    provider: string;
    model: string;
    endpoint: string;
    display_name?: string;
    meters: Array<{
        meter: string;
        unit: string;
        unit_size: number;
        price_per_unit: string;
        currency: string;
        conditions?: any[];
        billing_timestamp_basis?: string;
        time_windows?: any[];
    }>;
};

async function handlePricingModels(req: Request) {
    const auth = await guardAuth(req, { allowOAuthJwt: true });
    if (!auth.ok) {
        return (auth as GuardErr).response;
    }
    const scopeError = requireCapability(auth.value, CAPABILITIES.PRICING_READ);
    if (scopeError) return scopeError;

    try {
        const rows = await loadPricingCatalogueRows();
        const routes = new Map(rows.routes.map((route) => [route.providerModelId, route]));
        const models = new Map(rows.models
            .filter((model) => !model.hidden && model.status !== "disabled" && model.status !== "retired")
            .map((model) => [model.modelSlug, model]));
        const skuById = new Map(rows.skus.map((sku) => [sku.skuId, sku]));
        const modelMap = new Map<string, PricingModel>();
        for (const meter of rows.meters) {
            const sku = skuById.get(meter.skuId);
            const route = sku ? routes.get(sku.providerModelId) : null;
            const model = route ? models.get(route.modelSlug) : null;
            if (!sku || !route || !model) continue;
            const capabilityId = sku.operation;
            const key = `${route.providerSlug}:${route.modelSlug}:${capabilityId}:${sku.serviceTierSlug || "standard"}`;

            if (!modelMap.has(key)) {
                modelMap.set(key, {
                    provider: route.providerSlug,
                    model: route.modelSlug,
                    endpoint: capabilityId,
                    display_name: model.name,
                    meters: [],
                });
            }

            const metadata = meter.metadata && typeof meter.metadata === "object" ? meter.metadata as Record<string, any> : {};
            const skuMetadata = sku.metadata && typeof sku.metadata === "object" ? sku.metadata as Record<string, any> : {};
            modelMap.get(key)!.meters.push({
                meter: meter.meterKey,
                unit: meter.unit,
                unit_size: Number(meter.unitQuantity ?? 1),
                price_per_unit: String(Number(meter.priceNanos) / 1_000_000_000),
                currency: sku.currency ?? "USD",
                conditions: Array.isArray(skuMetadata.match) ? skuMetadata.match : Array.isArray(metadata.match) ? metadata.match : [],
                billing_timestamp_basis: skuMetadata.billing_timestamp_basis ?? "request_start",
                time_windows: Array.isArray(skuMetadata.time_windows) ? skuMetadata.time_windows : [],
            });
        }

        const pricingModels = Array.from(modelMap.values());

        // Sort by provider, then model
        pricingModels.sort((a, b) => {
            if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
            if (a.model !== b.model) return a.model.localeCompare(b.model);
            return a.endpoint.localeCompare(b.endpoint);
        });

        const cacheOptions = {
            scope: `pricing-models:${auth.value.workspaceId}`,
            ttlSeconds: 300,
            staleSeconds: 600,
        };
        const response = json(
            { ok: true, models: pricingModels },
            200,
            cacheHeaders(cacheOptions)
        );
        return response;
    } catch (error: any) {
        return json(
            { ok: false, error: "failed", message: String(error?.message ?? error) },
            500,
            { "Cache-Control": "no-store" }
        );
    }
}

async function handlePricingCalculate(req: Request) {
    const auth = await guardAuth(req, { useKvCache: false, allowOAuthJwt: true });
    if (!auth.ok) {
        return (auth as GuardErr).response;
    }
    const scopeError = requireCapability(auth.value, CAPABILITIES.PRICING_READ);
    if (scopeError) return scopeError;

    try {
        const body = await req.json();
        const {
            provider,
            model,
            endpoint,
            usage,
            request_started_at,
            provider_accepted_at,
            completed_at,
        } = body;

        if (!provider || !model || !endpoint || !usage) {
            return json(
                { ok: false, error: "missing_required_fields", message: "provider, model, endpoint, and usage are required" },
                400
            );
        }

        // Load the price card
        const { loadPriceCard } = await import("@pipeline/pricing/loader");
        const { computeBillSummary } = await import("@pipeline/pricing/engine");

        const card = await loadPriceCard(provider, model, endpoint);
        if (!card) {
            return json(
                { ok: false, error: "pricing_not_found", message: "No pricing data found for this model" },
                404
            );
        }

        // Calculate pricing
        const pricingOptions: Record<string, unknown> = {};
        if (request_started_at != null) pricingOptions.request_started_at = request_started_at;
        if (provider_accepted_at != null) pricingOptions.provider_accepted_at = provider_accepted_at;
        if (completed_at != null) pricingOptions.completed_at = completed_at;

        const result = computeBillSummary(
            usage,
            card,
            pricingOptions,
            "standard",
        );

        return json(
            { ok: true, pricing: result },
            200,
            { "Cache-Control": "no-store" }
        );
    } catch (error: any) {
        return json(
            { ok: false, error: "calculation_failed", message: String(error?.message ?? error) },
            500,
            { "Cache-Control": "no-store" }
        );
    }
}

export const pricingRoutes = new Hono<Env>();

pricingRoutes.get("/models", withRuntime(handlePricingModels));
pricingRoutes.post("/calculate", withRuntime(handlePricingCalculate));











