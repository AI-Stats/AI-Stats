import { v2ModelProviderRoutes, v2PricingSkuMeters, v2PricingSkus, v2Providers, v2RouteCapabilities } from "@phaseo/db/schema";
import { and, eq, inArray } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};

export async function loadModelPricingSources(env: Env, variants: string[], includeInternal: boolean, includeExpiredPricing: boolean) {
	const { db, client } = createDatabase(env);
	try {
		const routeConditions = [inArray(v2ModelProviderRoutes.modelSlug, variants)];
		if (!includeInternal) routeConditions.push(eq(v2ModelProviderRoutes.accessScope, "public"));
		const [routeRows, meterRows] = await Promise.all([
			db.select({ route: v2ModelProviderRoutes, provider: v2Providers, capability: v2RouteCapabilities })
				.from(v2ModelProviderRoutes).innerJoin(v2Providers, eq(v2Providers.providerSlug, v2ModelProviderRoutes.providerSlug))
				.leftJoin(v2RouteCapabilities, eq(v2RouteCapabilities.providerModelId, v2ModelProviderRoutes.providerModelId)).where(and(...routeConditions)),
			db.select({ route: v2ModelProviderRoutes, sku: v2PricingSkus, meter: v2PricingSkuMeters })
				.from(v2ModelProviderRoutes).innerJoin(v2PricingSkus, eq(v2PricingSkus.providerModelId, v2ModelProviderRoutes.providerModelId))
				.innerJoin(v2PricingSkuMeters, eq(v2PricingSkuMeters.skuId, v2PricingSkus.skuId)).where(and(...routeConditions)),
		]);
		const grouped = new Map<string, { route: typeof routeRows[number]["route"]; provider: typeof routeRows[number]["provider"]; capabilities: Row[] }>();
		for (const row of routeRows) { const entry = grouped.get(row.route.providerModelId) ?? { route: row.route, provider: row.provider, capabilities: [] }; if (row.capability && (includeInternal || row.capability.status !== "internal_testing")) entry.capabilities.push({ provider_model_id: row.capability.providerModelId, capability_id: row.capability.capabilityId, params: row.capability.params, max_input_tokens: row.capability.maxInputTokens, max_output_tokens: row.capability.maxOutputTokens, status: row.capability.status }); grouped.set(row.route.providerModelId, entry); }
		const providerRows = [...grouped.values()].map(({ route, provider, capabilities }) => { const metadata = object(provider.metadata); return { provider_api_model_id: route.providerModelId, provider_id: route.providerSlug, api_model_id: route.modelSlug, model_id: route.modelSlug, provider_model_slug: route.providerModelSlug, is_active_gateway: Boolean(route.routingEnabled && ["active", "degraded"].includes(route.status)), routing_status: route.status, provider_availability_status: route.providerAvailabilityStatus, phaseo_status: route.phaseoStatus, access_scope: route.accessScope, input_modalities: route.inputModalities, output_modalities: route.outputModalities, context_length: route.contextLength, max_output_tokens: route.maxOutputTokens, effective_from: route.effectiveFrom, effective_to: route.effectiveTo, created_at: route.createdAt, updated_at: route.updatedAt, data_api_provider_model_capabilities: capabilities, data_api_providers: { api_provider_name: provider.name, provider_family_id: provider.providerFamilySlug, offer_label: provider.offerLabel, offer_scope: provider.offerScope, colour: metadata.colour ?? null, link: metadata.link ?? null, country_code: provider.countryCode, status: provider.status, routing_status: provider.routingEnabled ? "active" : "disabled", residency_mode: provider.residencyMode, default_execution_regions: provider.defaultExecutionRegions, default_data_regions: provider.defaultDataRegions, zero_data_retention: provider.zeroDataRetention, data_retention_days: provider.dataRetentionDays, prompt_training_policy: provider.promptTrainingPolicy, prompt_training_notes: metadata.prompt_training_notes ?? null, prompt_training_source_url: metadata.prompt_training_source_url ?? null, data_policy_tier: provider.dataPolicyTier, data_policy_confidence: provider.dataPolicyConfidence, data_policy_contract_mode: provider.dataPolicyContractMode, data_policy_contract_notes: metadata.data_policy_contract_notes ?? null, residency_source_url: metadata.residency_source_url ?? null, residency_notes: metadata.residency_notes ?? null, privacy_policy_url: metadata.privacy_policy_url ?? null, terms_of_service_url: metadata.terms_of_service_url ?? null } }; });
		const now = Date.now();
		const pricingRows = meterRows.flatMap(({ route, sku, meter }) => { if (sku.status === "disabled" || (!includeExpiredPricing && sku.effectiveTo && now >= Date.parse(sku.effectiveTo))) return []; const priceNanos = Number(meter.priceNanos); if (!Number.isFinite(priceNanos)) return []; const skuMetadata = object(sku.metadata); const meterMetadata = object(meter.metadata); return [{ rule_id: meter.skuMeterId, model_key: `${route.providerSlug}:${route.modelSlug}:${sku.operation || "inference"}`, capability_id: sku.operation, pricing_plan: sku.serviceTierSlug ?? "standard", meter: meter.meterKey, unit: meter.unit, unit_size: Number(meter.unitQuantity), price_per_unit: priceNanos / 1_000_000_000, currency: sku.currency, priority: Number(meterMetadata.priority ?? meter.meterOrder), effective_from: sku.effectiveFrom, effective_to: sku.effectiveTo, note: null, match: [], billing_timestamp_basis: skuMetadata.billing_timestamp_basis ?? "request_start", time_windows: skuMetadata.time_windows ?? [] }]; });
		return { providerRows, pricingRows };
	} finally { await client.end({ timeout: 1 }); }
}
