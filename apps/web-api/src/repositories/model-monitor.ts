import { v2Labs, v2ModelProviderRoutes, v2Models, v2PricingSkuMeters, v2PricingSkus, v2Providers, v2RouteCapabilities, v2RpcGatewayModelUsageDaily } from "@phaseo/db/schema";
import { sql } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function listGatewayMonitorRows(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		const cacheBucketMs = 15 * 60 * 1_000;
		const asOf = new Date(Math.floor(Date.now() / cacheBucketMs) * cacheBucketMs);
		const windowStart = new Date(asOf);
		windowStart.setUTCHours(0, 0, 0, 0);
		windowStart.setUTCDate(windowStart.getUTCDate() - 7);
		const rows = await db.execute<Record<string, unknown>>(sql`
			/*application='phaseo-web-api',service='web-api',route='/api/_web/models',feature='catalogue-table'*/
			with weekly as (
				select model_id, provider_id, sum(total_tokens)::bigint tokens,
					sum(latency_sum_ms)::numeric / nullif(sum(latency_samples), 0) latency,
					sum(throughput_sum)::numeric / nullif(sum(throughput_samples), 0) throughput
				from ${v2RpcGatewayModelUsageDaily}
				where day_bucket >= ${windowStart.toISOString().slice(0, 10)}::date
				group by model_id, provider_id
			), pricing_by_tier as (
				select sku.provider_model_id, coalesce(sku.service_tier_slug, 'standard') service_tier_slug,
					min(meter.price_nanos::numeric / meter.unit_quantity * 1000000 / 1000000000) filter (where meter.meter_key in ('input_tokens', 'input_text_tokens')) input_price,
					min(meter.price_nanos::numeric / meter.unit_quantity * 1000000 / 1000000000) filter (where meter.meter_key in ('output_tokens', 'output_text_tokens')) output_price
				from ${v2PricingSkus} sku
				join ${v2PricingSkuMeters} meter using (sku_id)
				where sku.status <> 'disabled'
					and sku.effective_from <= ${asOf.toISOString()}::timestamptz
					and (sku.effective_to is null or sku.effective_to > ${asOf.toISOString()}::timestamptz)
				group by sku.provider_model_id, coalesce(sku.service_tier_slug, 'standard')
			), pricing as (
				select distinct on (provider_model_id) *
				from pricing_by_tier
				order by provider_model_id, (service_tier_slug = 'standard') desc, service_tier_slug
			)
			select model.model_slug model_id, model.name model_name, model.released_at model_release_date,
				model.retired_at model_retirement_date, model.status model_status,
				model.input_modalities model_input_types, model.output_modalities model_output_types,
				model.lab_slug organisation_id, lab.name organisation_name, model.hidden,
				route.provider_model_id provider_api_model_id, route.provider_slug provider_id,
				route.model_slug api_model_id, route.provider_model_slug, route.routing_enabled is_active_gateway,
				route.input_modalities, route.output_modalities, route.context_length,
				route.max_output_tokens provider_max_output_tokens, route.effective_from, route.effective_to,
				cap.capability_id, cap.params capability_params, cap.status capability_status,
				cap.max_input_tokens capability_max_input_tokens, cap.max_output_tokens capability_max_output_tokens,
				provider.name api_provider_name, coalesce(pricing.input_price, 0) input_price,
				coalesce(pricing.output_price, 0) output_price, pricing.input_price standard_input_price,
				pricing.output_price standard_output_price,
				case when pricing.input_price is not null then 'Text Input' end standard_input_price_label,
				case when pricing.input_price is not null then '1M tokens' end standard_input_price_unit,
				case when pricing.output_price is not null then 'Text Output' end standard_output_price_label,
				case when pricing.output_price is not null then '1M tokens' end standard_output_price_unit,
				least(pricing.input_price, pricing.output_price) from_price,
				case when pricing.input_price is not null or pricing.output_price is not null then '1M tokens' end from_price_unit,
				coalesce(pricing.service_tier_slug, 'standard') pricing_tier,
				(model.variant_kind = 'free' or model.model_slug like '%:free') is_free_variant,
				sum(weekly.tokens) over (partition by model.model_slug) weekly_tokens_model,
				weekly.tokens weekly_tokens_model_provider, weekly.throughput weekly_throughput_model,
				weekly.latency weekly_latency_model
			from ${v2Models} model
			join ${v2Labs} lab on lab.lab_slug = model.lab_slug
			join ${v2ModelProviderRoutes} route on route.model_slug = model.model_slug
			join ${v2Providers} provider on provider.provider_slug = route.provider_slug
			join ${v2RouteCapabilities} cap on cap.provider_model_id = route.provider_model_id
				and (cap.status is null or cap.status not in ('disabled', 'internal_testing'))
			left join pricing on pricing.provider_model_id = route.provider_model_id
			left join weekly on weekly.model_id = model.model_slug and weekly.provider_id = route.provider_slug
			where model.hidden = false
			order by route.provider_model_id, cap.capability_id
		`);
		return [...rows];
	} finally {
		await client.end({ timeout: 1 });
	}
}
