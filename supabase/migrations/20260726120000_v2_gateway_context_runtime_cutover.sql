-- Recompile the gateway context RPC against V2 catalogue projections.
-- The operational key/workspace/wallet portions stay unchanged; every model,
-- route, capability, alias, and pricing read is redirected to V2.
do $migration$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.gateway_fetch_request_context(uuid,text,text,uuid)'::regprocedure
  ) into definition;

  definition := replace(
    definition,
    'public.data_api_model_aliases',
    '(select alias_slug, model_slug as api_model_id, enabled as is_enabled from public.v2_model_aliases)'
  );
  definition := replace(
    definition,
    'public.data_api_provider_models',
    '(select provider_model_id as provider_api_model_id, provider_slug as provider_id, model_slug as api_model_id, model_slug as model_id, provider_model_slug, routing_enabled as is_active_gateway, status as routing_status, input_modalities, output_modalities, context_length, max_output_tokens, effective_from, effective_to, created_at, updated_at from public.v2_model_provider_routes)'
  );
  definition := replace(
    definition,
    'public.data_models',
    '(select model_slug as model_id, lab_slug as organisation_id, name, description, status, hidden, announced_at as announcement_date, released_at as release_date, deprecated_at as deprecation_date, retired_at as retirement_date, previous_model_slug as previous_model_id, input_modalities as input_types, output_modalities as output_types, metadata, created_at, updated_at from public.v2_models)'
  );
  definition := replace(
    definition,
    'public.data_api_provider_model_capabilities',
    '(select provider_model_id as provider_api_model_id, capability_id, status, params, max_input_tokens, max_output_tokens, effective_from, effective_to, created_at, updated_at from public.v2_route_capabilities)'
  );
  definition := replace(
    definition,
    'public.data_api_pricing_rules',
    '(select meter.sku_meter_id::text as rule_id, route.provider_slug as provider_id, route.model_slug as api_model_id, route.provider_slug || '':'' || route.model_slug || '':'' || sku.operation as model_key, sku.operation as capability_id, coalesce(sku.service_tier_slug, ''standard'') as pricing_plan, meter.meter_key as meter, meter.unit, meter.unit_quantity as unit_size, meter.price_nanos / 1000000000.0 as price_per_unit, sku.currency, meter.meter_order as priority, sku.effective_from, sku.effective_to, coalesce(sku.metadata->''match'', meter.metadata->''match'', ''[]''::jsonb) as match, coalesce(sku.metadata->>''billing_timestamp_basis'', ''request_start'') as billing_timestamp_basis, coalesce(sku.metadata->''time_windows'', ''[]''::jsonb) as time_windows, greatest(sku.updated_at, meter.updated_at) as updated_at from public.v2_pricing_skus sku join public.v2_model_provider_routes route on route.provider_model_id = sku.provider_model_id join public.v2_pricing_sku_meters meter on meter.sku_id = sku.sku_id where sku.status = ''active'' and meter.billable)'
  );

  if definition ~ 'public\.data_(models|api_)' then
    raise exception 'gateway context V2 rewrite left legacy catalogue references';
  end if;

  execute definition;
end
$migration$;

comment on function public.gateway_fetch_request_context(uuid, text, text, uuid)
  is 'Gateway request context backed exclusively by V2 catalogue, routing, capability, and SKU tables.';
