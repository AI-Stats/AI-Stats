create table if not exists catalog.model_discovery_state (
	scope text not null,
	state_key text not null,
	value jsonb not null,
	updated_at timestamp with time zone default now() not null,
	constraint model_discovery_state_pkey primary key (scope, state_key)
);
--> statement-breakpoint
insert into catalog.model_discovery_state (scope, state_key, value, updated_at)
select '__global__', 'pricing_cursor',
	jsonb_build_object(
		'updatedAt', summary->'pricingMonitor'->>'cursorUpdatedAt',
		'ruleIdsAtTimestamp', coalesce(summary->'pricingMonitor'->'ruleIdsAtTimestamp', '[]'::jsonb)
	),
	coalesce(finished_at, started_at)
from catalog.model_discovery_runs
where status in ('completed', 'completed_with_errors')
	and nullif(summary->'pricingMonitor'->>'cursorUpdatedAt', '') is not null
order by started_at desc
limit 1
on conflict (scope, state_key) do nothing;
--> statement-breakpoint
create or replace function catalog.get_public_models_page_rows(
	p_region text,
	p_service_tier text,
	p_as_of timestamp with time zone
)
returns table (row_data jsonb)
language sql
stable
as $$
	with eligible_route_variants as (
		select route.model_slug, route.provider_model_id, route.provider_slug,
			route.provider_model_slug, route.status route_status,
			route.input_modalities, route.output_modalities, route.regions route_regions,
			route.context_length, provider.name provider_name, provider.status provider_status,
			variant.service_tier_slug, variant.execution_region, variant.data_region,
			provider_region.region_code provider_region_code,
			(route.status = 'active' and route.routing_enabled and provider.routing_enabled
				and provider.status not in ('disabled', 'deprecated', 'external')) is_active
		from catalog.v2_model_provider_routes route
		join catalog.v2_providers provider on provider.provider_slug = route.provider_slug
		join catalog.v2_route_variants variant on variant.provider_model_id = route.provider_model_id
		left join catalog.v2_provider_regions provider_region
			on provider_region.provider_region_id = variant.provider_region_id
			and provider_region.status <> 'disabled' and provider_region.routing_enabled = true
		where route.status in ('active', 'degraded') and route.routing_enabled = true
			and provider.status <> 'disabled' and provider.routing_enabled = true
			and variant.status in ('active', 'degraded') and variant.routing_enabled = true
			and (p_service_tier is null or lower(variant.service_tier_slug) = lower(p_service_tier))
			and (p_region is null or lower(p_region) = any(array[
				lower(coalesce(variant.execution_region, '')),
				lower(coalesce(variant.data_region, '')),
				lower(coalesce(provider_region.region_code, ''))
			]) or exists (
				select 1 from unnest(coalesce(route.regions, array[]::text[])) route_region
				where lower(route_region) = lower(p_region)
			) or exists (
				select 1 from catalog.v2_provider_regions available_region
				where available_region.provider_slug = route.provider_slug
					and available_region.status <> 'disabled' and available_region.routing_enabled = true
					and lower(available_region.region_code) = lower(p_region)
			))
	), route_rollup as (
		select model_slug,
			count(distinct provider_model_id)::int gateway_provider_count,
			count(distinct provider_model_id) filter (where is_active)::int gateway_active_provider_count,
			coalesce(array_agg(distinct provider_name) filter (where provider_name is not null), array[]::text[]) gateway_provider_names,
			coalesce(array_agg(distinct provider_name) filter (where is_active and provider_name is not null), array[]::text[]) gateway_active_provider_names,
			coalesce(array_agg(distinct service_tier_slug) filter (where service_tier_slug is not null), array[]::text[]) gateway_tiers,
			coalesce(array_agg(distinct provider_model_slug) filter (where provider_model_slug is not null), array[]::text[]) gateway_api_model_ids,
			coalesce(array_agg(distinct context_length) filter (where context_length is not null), array[]::integer[]) context_lengths,
			coalesce(jsonb_agg(jsonb_build_object(
				'id', provider_slug, 'name', provider_name, 'status', provider_status,
				'provider_model_slug', provider_model_slug, 'service_tier', service_tier_slug,
				'execution_region', execution_region, 'data_region', data_region, 'is_active', is_active
			) order by provider_name, provider_model_slug, service_tier_slug), '[]'::jsonb) gateway_provider_details
		from eligible_route_variants
		group by model_slug
	), route_regions as (
		select model_slug, coalesce(array_agg(distinct region) filter (where region is not null and region <> ''), array[]::text[]) gateway_execution_regions
		from (
			select model_slug, unnest(coalesce(route_regions, array[]::text[])) region from eligible_route_variants
			union all select model_slug, execution_region from eligible_route_variants
			union all select model_slug, data_region from eligible_route_variants
			union all select model_slug, provider_region_code from eligible_route_variants
			union all
			select route.model_slug, provider_region.region_code
			from (select distinct model_slug, provider_slug from eligible_route_variants) route
			join catalog.v2_provider_regions provider_region on provider_region.provider_slug = route.provider_slug
				and provider_region.status <> 'disabled' and provider_region.routing_enabled = true
		) values_by_region
		group by model_slug
	), route_modalities as (
		select model_slug,
			coalesce(array_agg(distinct input_modality) filter (where input_modality is not null), array[]::text[]) gateway_input_modalities,
			coalesce(array_agg(distinct output_modality) filter (where output_modality is not null), array[]::text[]) gateway_output_modalities
		from eligible_route_variants route
		left join lateral unnest(coalesce(route.input_modalities, array[]::text[])) input_modality on true
		left join lateral unnest(coalesce(route.output_modalities, array[]::text[])) output_modality on true
		group by model_slug
	), capability_rollup as (
		select route.model_slug,
			coalesce(array_agg(distinct capability.capability_id) filter (where capability.capability_id is not null), array[]::text[]) gateway_endpoints,
			coalesce(array_agg(distinct parameter.key) filter (where parameter.key is not null), array[]::text[]) supported_parameters
		from (select distinct model_slug, provider_model_id from eligible_route_variants) route
		join catalog.v2_route_capabilities capability on capability.provider_model_id = route.provider_model_id
			and capability.status <> 'disabled'
		left join lateral jsonb_object_keys(
			case when jsonb_typeof(capability.params) = 'object' then capability.params else '{}'::jsonb end
		) parameter(key) on true
		group by route.model_slug
	), pricing_rows as (
		select route.model_slug, meter.direction, meter.meter_key, meter.unit,
			meter.unit_quantity, meter.price_nanos::numeric / 1000000000 price,
			meter.display_label, meter.display_unit, meter.meter_order,
			coalesce(sku.service_tier_slug, 'standard') service_tier_slug
		from (select distinct model_slug, provider_model_id from eligible_route_variants) route
		join catalog.v2_pricing_skus sku on sku.provider_model_id = route.provider_model_id
		join catalog.v2_pricing_sku_meters meter on meter.sku_id = sku.sku_id and meter.billable = true
		where sku.status <> 'disabled'
			and (p_service_tier is null or lower(coalesce(sku.service_tier_slug, 'standard')) = lower(p_service_tier))
			and sku.effective_from <= p_as_of and (sku.effective_to is null or sku.effective_to > p_as_of)
	), pricing_rollup as (
		select model_slug,
			min(price) filter (where direction = 'input') lowest_input_price,
			min(price) filter (where direction = 'output') lowest_output_price,
			coalesce(jsonb_agg(jsonb_build_object(
				'label', display_label, 'meter_key', meter_key, 'unit', unit,
				'unit_quantity', unit_quantity, 'price', price, 'display_unit', display_unit,
				'service_tier', service_tier_slug, 'direction', direction
			) order by meter_order, meter_key), '[]'::jsonb) pricing_detail_rows
		from pricing_rows group by model_slug
	), model_rows as (
		select model.*, lab.name organisation_name
		from catalog.v2_models model
		join catalog.v2_labs lab on lab.lab_slug = model.lab_slug
		where model.hidden = false and model.status <> 'disabled'
	)
	select jsonb_build_object(
		'model_id', model.model_slug, 'name', model.name, 'description', model.description,
		'organisation_id', model.lab_slug, 'organisation_name', model.organisation_name,
		'primary_date', coalesce(model.released_at, model.announced_at),
		'primary_timestamp', extract(epoch from coalesce(model.released_at, model.announced_at)) * 1000,
		'primary_group_key', to_char(coalesce(model.released_at, model.announced_at), 'YYYY-MM'),
		'variant_kind', model.variant_kind, 'base_model_slug', model.base_model_slug,
		'gateway_status', case when coalesce(route.gateway_active_provider_count, 0) > 0 then 'active' when model.status = 'draft' then 'coming_soon' else 'not_active' end,
		'gateway_provider_count', coalesce(route.gateway_provider_count, 0),
		'gateway_active_provider_count', coalesce(route.gateway_active_provider_count, 0),
		'gateway_endpoints', coalesce(capability.gateway_endpoints, array[]::text[]),
		'gateway_input_modalities', case when cardinality(coalesce(modality.gateway_input_modalities, array[]::text[])) > 0 then modality.gateway_input_modalities else model.input_modalities end,
		'gateway_output_modalities', case when cardinality(coalesce(modality.gateway_output_modalities, array[]::text[])) > 0 then modality.gateway_output_modalities else model.output_modalities end,
		'gateway_features', coalesce((select array_agg(distinct feature) from (
			select case when endpoint ~* 'tool' then 'tools' when endpoint ~* 'structured' then 'structured_outputs'
				when endpoint ~* '(reason|thinking)' then 'reasoning' when endpoint ~* 'search' then 'web_search' end feature
			from unnest(coalesce(capability.gateway_endpoints, array[]::text[])) endpoint
		) features where feature is not null), array[]::text[]),
		'gateway_tiers', coalesce(route.gateway_tiers, array[]::text[]),
		'gateway_provider_names', coalesce(route.gateway_provider_names, array[]::text[]),
		'gateway_active_provider_names', coalesce(route.gateway_active_provider_names, array[]::text[]),
		'gateway_execution_regions', coalesce(region.gateway_execution_regions, array[]::text[]),
		'gateway_provider_details', coalesce(route.gateway_provider_details, '[]'::jsonb),
		'gateway_api_model_ids', coalesce(route.gateway_api_model_ids, array[]::text[]),
		'context_lengths', coalesce(route.context_lengths, array[]::integer[]),
		'supported_parameters', coalesce(capability.supported_parameters, array[]::text[]),
		'lowest_input_price', pricing.lowest_input_price, 'lowest_output_price', pricing.lowest_output_price,
		'lowest_standard_input_price', pricing.lowest_input_price, 'lowest_standard_output_price', pricing.lowest_output_price,
		'lowest_standard_input_price_label', 'Input', 'lowest_standard_input_price_unit', 'billing unit',
		'lowest_standard_output_price_label', 'Output', 'lowest_standard_output_price_unit', 'billing unit',
		'lowest_from_price', least(pricing.lowest_input_price, pricing.lowest_output_price),
		'lowest_from_price_unit', 'billing unit', 'pricing_detail_rows', coalesce(pricing.pricing_detail_rows, '[]'::jsonb),
		'gateway_monitor_rows', '[]'::jsonb, 'popularity_tokens_week', null,
		'throughput_week', null, 'latency_week', null
	) row_data
	from model_rows model
	left join route_rollup route on route.model_slug = model.model_slug
	left join route_regions region on region.model_slug = model.model_slug
	left join route_modalities modality on modality.model_slug = model.model_slug
	left join capability_rollup capability on capability.model_slug = model.model_slug
	left join pricing_rollup pricing on pricing.model_slug = model.model_slug
	order by coalesce(model.released_at, model.announced_at) desc nulls last, model.organisation_name, model.name;
$$;
--> statement-breakpoint
insert into catalog.model_discovery_state (scope, state_key, value, updated_at)
select distinct on (scope, state_key)
	scope, state_key, value, coalesce(finished_at, started_at)
from (
	select coalesce(nullif(source, ''), '__global__') scope, started_at, finished_at, 'configured_coverage'::text state_key,
		summary->'configuredModelCoverageMonitor' value
	from catalog.model_discovery_runs
	where status in ('completed', 'completed_with_errors')
		and summary->'configuredModelCoverageMonitor' is not null
	union all
	select coalesce(nullif(source, ''), '__global__'), started_at, finished_at, 'notification_fingerprint',
		to_jsonb(summary->>'notificationFingerprint')
	from catalog.model_discovery_runs
	where status in ('completed', 'completed_with_errors')
		and nullif(summary->>'notificationFingerprint', '') is not null
	union all
	select coalesce(nullif(source, ''), '__global__'), started_at, finished_at, 'pricing_table',
		coalesce(summary->'pricingTableMonitor'->'sources', '[]'::jsonb)
	from catalog.model_discovery_runs
	where status in ('completed', 'completed_with_errors')
		and summary->'pricingTableMonitor'->'sources' is not null
) state_rows
order by scope, state_key, started_at desc
on conflict (scope, state_key) do nothing;
