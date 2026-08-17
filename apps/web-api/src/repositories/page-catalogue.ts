import { v2Labs, v2ModelProviderRoutes, v2Models, v2PricingSkuMeters, v2PricingSkus, v2ProviderRegions, v2Providers, v2PublicUsageDaily, v2PublicUsageDailyMeters, v2RouteCapabilities, v2RouteVariants } from "@phaseo/db/schema";
import { and, eq, ne, sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

type CatalogueQuery = { region?: string | null; serviceTier?: string | null };
const unique = <T>(values: T[]) => [...new Set(values.filter((value) => value != null))];

export async function listPublicModelsPageRows(env: Env, query: CatalogueQuery = {}) {
	const { db, client } = createDatabase(env);
	try {
		const [modelRows, routeRows, providers, variants, regions, capabilities, skus, meters] = await Promise.all([
			db.select({ model: v2Models, lab: v2Labs }).from(v2Models).innerJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug)).where(and(eq(v2Models.hidden, false), ne(v2Models.status, "disabled"))),
			db.select().from(v2ModelProviderRoutes),
			db.select().from(v2Providers),
			db.select().from(v2RouteVariants),
			db.select().from(v2ProviderRegions).where(and(ne(v2ProviderRegions.status, "disabled"), eq(v2ProviderRegions.routingEnabled, true))),
			db.select().from(v2RouteCapabilities).where(ne(v2RouteCapabilities.status, "disabled")),
			db.select().from(v2PricingSkus).where(ne(v2PricingSkus.status, "disabled")),
			db.select().from(v2PricingSkuMeters).where(eq(v2PricingSkuMeters.billable, true)),
		]);
		const providerById = new Map(providers.map((row) => [row.providerSlug, row]));
		const regionsByProvider = new Map<string, typeof regions>();
		const regionById = new Map(regions.map((row) => [String(row.providerRegionId), row]));
		for (const row of regions) regionsByProvider.set(row.providerSlug, [...(regionsByProvider.get(row.providerSlug) ?? []), row]);
		const variantsByRoute = new Map<string, typeof variants>();
		for (const row of variants) variantsByRoute.set(row.providerModelId, [...(variantsByRoute.get(row.providerModelId) ?? []), row]);
		const capsByRoute = new Map<string, typeof capabilities>();
		for (const row of capabilities) capsByRoute.set(row.providerModelId, [...(capsByRoute.get(row.providerModelId) ?? []), row]);
		const metersBySku = new Map<string, typeof meters>();
		for (const row of meters) metersBySku.set(String(row.skuId), [...(metersBySku.get(String(row.skuId)) ?? []), row]);
		const modelBySlug = new Map(modelRows.map((row) => [row.model.modelSlug, row]));
		const routesByModel = new Map<string, Array<{ route: (typeof routeRows)[number]; provider: (typeof providers)[number]; variants: typeof variants }>>();
		const wantedTier = query.serviceTier?.trim().toLowerCase() || null;
		const wantedRegion = query.region?.trim().toLowerCase() || null;
		for (const route of routeRows) {
			const provider = providerById.get(route.providerSlug);
			if (!modelBySlug.has(route.modelSlug) || !provider || !["active", "degraded"].includes(route.status) || !route.routingEnabled || provider.status === "disabled" || !provider.routingEnabled) continue;
			const eligibleVariants = (variantsByRoute.get(route.providerModelId) ?? []).filter((variant) => {
				if (!["active", "degraded"].includes(variant.status) || !variant.routingEnabled) return false;
				if (wantedTier && variant.serviceTierSlug.toLowerCase() !== wantedTier) return false;
				if (!wantedRegion) return true;
				const providerRegion = variant.providerRegionId ? regionById.get(String(variant.providerRegionId)) : null;
				return [variant.executionRegion, variant.dataRegion, providerRegion?.regionCode, ...(route.regions ?? [])].some((value) => String(value ?? "").toLowerCase() === wantedRegion);
			});
			if (!eligibleVariants.length) continue;
			routesByModel.set(route.modelSlug, [...(routesByModel.get(route.modelSlug) ?? []), { route, provider, variants: eligibleVariants }]);
		}
		const now = Date.now();
		const result: Record<string, unknown>[] = [];
		for (const { model, lab } of modelRows) {
			const routed = routesByModel.get(model.modelSlug) ?? [];
			const providerDetails = routed.flatMap(({ route, provider, variants: routeVariants }) => routeVariants.map((variant) => ({
				id: provider.providerSlug, name: provider.name, status: provider.status, provider_model_slug: route.providerModelSlug,
				service_tier: variant.serviceTierSlug, execution_region: variant.executionRegion, data_region: variant.dataRegion,
				is_active: route.status === "active" && route.routingEnabled && provider.routingEnabled && !["disabled", "deprecated", "external"].includes(provider.status),
			})));
			const routeIds = routed.map(({ route }) => route.providerModelId);
			const caps = routeIds.flatMap((id) => capsByRoute.get(id) ?? []);
			const capabilityIds = unique(caps.map((cap) => cap.capabilityId)).sort();
			const features = unique(capabilityIds.map((id) => /tool/i.test(id) ? "tools" : /structured/i.test(id) ? "structured_outputs" : /(reason|thinking)/i.test(id) ? "reasoning" : /search/i.test(id) ? "web_search" : null).filter(Boolean) as string[]).sort();
			const pricingRows = skus.filter((sku) => routeIds.includes(sku.providerModelId) && (!wantedTier || String(sku.serviceTierSlug ?? "").toLowerCase() === wantedTier) && Date.parse(sku.effectiveFrom) <= now && (!sku.effectiveTo || Date.parse(sku.effectiveTo) > now)).flatMap((sku) => (metersBySku.get(String(sku.skuId)) ?? []).map((meter) => ({ label: meter.displayLabel, meter_key: meter.meterKey, unit: meter.unit, unit_quantity: Number(meter.unitQuantity), price: Number(meter.priceNanos) / 1_000_000_000, display_unit: meter.displayUnit, service_tier: sku.serviceTierSlug ?? "standard", direction: meter.direction, order: meter.meterOrder })));
			pricingRows.sort((left, right) => left.order - right.order || left.meter_key.localeCompare(right.meter_key));
			const inputPrices = pricingRows.filter((row) => row.direction === "input").map((row) => row.price);
			const outputPrices = pricingRows.filter((row) => row.direction === "output").map((row) => row.price);
			const lowestInput = inputPrices.length ? Math.min(...inputPrices) : null;
			const lowestOutput = outputPrices.length ? Math.min(...outputPrices) : null;
			const primaryDate = model.releasedAt ?? model.announcedAt;
			result.push({
				model_id: model.modelSlug, name: model.name, description: model.description, organisation_id: model.labSlug, organisation_name: lab.name,
				primary_date: primaryDate, primary_timestamp: primaryDate ? Date.parse(primaryDate) : null, primary_group_key: primaryDate ? primaryDate.slice(0, 7) : null,
				gateway_status: providerDetails.some((row) => row.is_active) ? "active" : model.status === "draft" ? "coming_soon" : "not_active",
				gateway_provider_count: unique(routed.map(({ route }) => route.providerModelId)).length,
				gateway_active_provider_count: unique(routed.filter(({ route, provider }) => route.status === "active" && provider.routingEnabled && !["disabled", "deprecated", "external"].includes(provider.status)).map(({ route }) => route.providerModelId)).length,
				gateway_endpoints: capabilityIds, gateway_input_modalities: unique(routed.flatMap(({ route }) => route.inputModalities ?? model.inputModalities)).sort(), gateway_output_modalities: unique(routed.flatMap(({ route }) => route.outputModalities ?? model.outputModalities)).sort(), gateway_features: features,
				gateway_tiers: unique(routed.flatMap((row) => row.variants.map((variant) => variant.serviceTierSlug))).sort(), gateway_provider_names: unique(routed.map(({ provider }) => provider.name)).sort(), gateway_active_provider_names: unique(routed.filter(({ route, provider }) => route.status === "active" && !["external", "disabled", "deprecated"].includes(provider.status)).map(({ provider }) => provider.name)).sort(),
				gateway_execution_regions: unique(routed.flatMap(({ route, provider, variants: routeVariants }) => [...routeVariants.flatMap((variant) => [variant.executionRegion, variant.dataRegion, variant.providerRegionId ? regionById.get(String(variant.providerRegionId))?.regionCode : null]), ...(regionsByProvider.get(provider.providerSlug) ?? []).map((region) => region.regionCode), ...(route.regions ?? [])]).filter((value): value is string => Boolean(value))).sort(),
				gateway_provider_details: providerDetails, gateway_api_model_ids: unique(routed.map(({ route }) => route.providerModelSlug)).sort(), context_lengths: unique(routed.map(({ route }) => route.contextLength).filter((value): value is number => value != null)).sort((a, b) => a - b), supported_parameters: unique(caps.flatMap((cap) => cap.params && typeof cap.params === "object" && !Array.isArray(cap.params) ? Object.keys(cap.params) : [])).sort(),
				lowest_input_price: lowestInput, lowest_output_price: lowestOutput, lowest_standard_input_price: lowestInput, lowest_standard_output_price: lowestOutput,
				lowest_standard_input_price_label: "Input", lowest_standard_input_price_unit: "billing unit", lowest_standard_output_price_label: "Output", lowest_standard_output_price_unit: "billing unit", lowest_from_price: lowestInput == null ? lowestOutput : lowestOutput == null ? lowestInput : Math.min(lowestInput, lowestOutput), lowest_from_price_unit: "billing unit",
				pricing_detail_rows: pricingRows.map(({ order: _order, direction: _direction, ...row }) => row), gateway_monitor_rows: [], popularity_tokens_week: null, throughput_week: null, latency_week: null,
			});
		}
		return result.sort((left, right) => Number(right.primary_timestamp ?? -Infinity) - Number(left.primary_timestamp ?? -Infinity) || String(left.organisation_name).localeCompare(String(right.organisation_name)) || String(left.name).localeCompare(String(right.name)));
	} finally { await client.end({ timeout: 1 }); }
}

export async function listPublicModelWeeklyMetrics(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.execute<Record<string, unknown>>(sql`
			with recent as materialized (
				select * from ${v2PublicUsageDaily}
				where usage_date between current_date - 6 and current_date
			), rollups as (
				select model_slug, sum(requests)::numeric requests,
					sum(latency_sum_ms)::numeric latency_sum_ms, sum(latency_count)::numeric latency_count,
					sum(throughput_sum)::numeric throughput_sum, sum(throughput_count)::numeric throughput_count
				from recent group by model_slug
			), meters as (
				select recent.model_slug,
					sum(meter.quantity) filter(where meter.meter_key in ('input_tokens','output_tokens') and meter.unit in ('token','tokens')) tokens,
					sum(meter.quantity) filter(where meter.meter_key in ('output_images','output_image') and meter.unit in ('image','images')) images,
					sum(meter.quantity) filter(where meter.meter_key in ('output_video_seconds','video_seconds') and meter.unit in ('second','seconds')) video_seconds,
					sum(meter.quantity) filter(where meter.meter_key in ('audio_seconds','input_audio_seconds','output_audio_seconds') and meter.unit in ('second','seconds')) audio_seconds,
					sum(meter.quantity) filter(where meter.meter_key in ('input_characters','output_characters','total_characters') and meter.unit in ('character','characters')) characters
				from ${v2PublicUsageDailyMeters} meter join recent on recent.rollup_id=meter.rollup_id group by recent.model_slug
			), classified as (
				select rollup.*, coalesce(meter.tokens,0) tokens, coalesce(meter.images,0) images,
					coalesce(meter.video_seconds,0) video_seconds, coalesce(meter.audio_seconds,0) audio_seconds,
					coalesce(meter.characters,0) characters, lower(coalesce(model.metadata->>'model_type','')) model_type,
					array_to_string(model.input_modalities,',') input_modalities, array_to_string(model.output_modalities,',') output_modalities
				from rollups rollup join ${v2Models} model on model.model_slug=rollup.model_slug left join meters meter on meter.model_slug=rollup.model_slug
			)
			select model_slug, tokens popularity_tokens_week,
				case when (model_type='video' or output_modalities~'video') and video_seconds>0 then 'video_seconds'
					when (model_type='image' or output_modalities~'image') and images>0 then 'images'
					when (input_modalities~'audio' or output_modalities~'audio') and audio_seconds>0 then 'audio_seconds'
					when model_type in ('embedding','rerank','moderation') then 'requests'
					when tokens>0 then 'tokens'
					when characters>0 and (model_type='audio' or output_modalities~'audio') then 'characters'
					else 'requests' end weekly_usage_metric,
				case when (model_type='video' or output_modalities~'video') and video_seconds>0 then video_seconds
					when (model_type='image' or output_modalities~'image') and images>0 then images
					when (input_modalities~'audio' or output_modalities~'audio') and audio_seconds>0 then audio_seconds
					when model_type in ('embedding','rerank','moderation') then requests
					when tokens>0 then tokens
					when characters>0 and (model_type='audio' or output_modalities~'audio') then characters
					else requests end weekly_usage_quantity,
				case when (model_type='video' or output_modalities~'video') and video_seconds>0 then 'seconds'
					when (model_type='image' or output_modalities~'image') and images>0 then 'images'
					when (input_modalities~'audio' or output_modalities~'audio') and audio_seconds>0 then 'seconds'
					when tokens>0 then 'tokens'
					when characters>0 and (model_type='audio' or output_modalities~'audio') then 'characters'
					else 'requests' end weekly_usage_unit,
				round(throughput_sum/nullif(throughput_count,0),2) throughput_week,
				round(latency_sum_ms/nullif(latency_count,0),2) latency_week
			from classified order by weekly_usage_quantity desc, model_slug
		`);
		return [...rows];
	} finally { await client.end({ timeout: 1 }); }
}
