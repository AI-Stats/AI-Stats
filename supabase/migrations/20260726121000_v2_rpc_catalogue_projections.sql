-- Read-only V2 projections used while public RPC response contracts retain
-- their established field names. These views never read the V1 catalogue.
create or replace view public.v2_rpc_labs_legacy_shape
with (security_invoker = true) as
select
  lab.*,
  lab.lab_slug as organisation_id,
  lab.metadata->>'colour' as colour,
  lab.metadata->>'link' as link
from public.v2_labs lab;

create or replace view public.v2_rpc_models_legacy_shape
with (security_invoker = true) as
select
  model.*,
  model.model_slug as model_id,
  model.model_slug as api_model_id,
  model.lab_slug as organisation_id,
  model.previous_model_slug as previous_model_id,
  model.announced_at as announcement_date,
  model.released_at as release_date,
  model.deprecated_at as deprecation_date,
  model.retired_at as retirement_date,
  array_to_string(model.input_modalities, ',') as input_types,
  array_to_string(model.output_modalities, ',') as output_types,
  model.family_slug as family_id,
  model.metadata->'timeline' as timeline
from public.v2_models model;

create or replace view public.v2_rpc_providers_legacy_shape
with (security_invoker = true) as
select
  provider.*,
  provider.provider_slug as api_provider_id,
  provider.name as api_provider_name,
  provider.lab_slug as organisation_id,
  case when provider.routing_enabled then 'active' else 'disabled' end as routing_status,
  provider.metadata->>'description' as description,
  coalesce(provider.metadata->>'link', provider.base_url) as link,
  provider.metadata->>'colour' as colour,
  provider.metadata->>'pricing_source_url' as pricing_source_url,
  provider.metadata->>'privacy_policy_url' as privacy_policy_url,
  provider.metadata->>'terms_of_service_url' as terms_of_service_url
from public.v2_providers provider;

create or replace view public.v2_rpc_routes_legacy_shape
with (security_invoker = true) as
select
  route.*,
  route.provider_model_id as provider_api_model_id,
  route.provider_slug as provider_id,
  route.model_slug as api_model_id,
  route.model_slug as model_id,
  route.model_slug as internal_model_id,
  route.routing_enabled as is_active_gateway,
  route.status as routing_status,
  route.metadata->>'quantization_scheme' as quantization_scheme,
  route.metadata->>'prompt_training_policy_override' as prompt_training_policy_override,
  route.metadata->>'prompt_training_override_notes' as prompt_training_override_notes,
  route.metadata->>'prompt_training_override_source_url' as prompt_training_override_source_url
from public.v2_model_provider_routes route;

create or replace view public.v2_rpc_capabilities_legacy_shape
with (security_invoker = true) as
select
  capability.*,
  capability.provider_model_id as provider_api_model_id
from public.v2_route_capabilities capability;

create or replace view public.v2_rpc_pricing_legacy_shape
with (security_invoker = true) as
select
  meter.sku_meter_id::text as rule_id,
  route.provider_slug as provider_id,
  route.model_slug as api_model_id,
  route.provider_slug || ':' || route.model_slug || ':' || sku.operation as model_key,
  sku.operation as capability_id,
  coalesce(sku.service_tier_slug, 'standard') as pricing_plan,
  meter.meter_key as meter,
  meter.unit,
  meter.unit_quantity as unit_size,
  meter.price_nanos / 1000000000.0 as price_per_unit,
  sku.currency,
  meter.meter_order as priority,
  sku.effective_from,
  sku.effective_to,
  coalesce(sku.metadata->'match', meter.metadata->'match', '[]'::jsonb) as match,
  coalesce(sku.metadata->>'billing_timestamp_basis', 'request_start') as billing_timestamp_basis,
  coalesce(sku.metadata->'time_windows', '[]'::jsonb) as time_windows,
  coalesce(meter.metadata->>'note', sku.description) as note,
  greatest(sku.created_at, meter.created_at) as created_at,
  greatest(sku.updated_at, meter.updated_at) as updated_at
from public.v2_pricing_skus sku
join public.v2_model_provider_routes route on route.provider_model_id = sku.provider_model_id
join public.v2_pricing_sku_meters meter on meter.sku_id = sku.sku_id
where meter.billable;

create or replace view public.v2_rpc_benchmarks_legacy_shape
with (security_invoker = true) as
select benchmark.*, benchmark.benchmark_id as id, benchmark.benchmark_type as type
from public.v2_benchmarks benchmark;

create or replace view public.v2_rpc_benchmark_results_legacy_shape
with (security_invoker = true) as
select result.*, result.result_id as id, result.model_slug as model_id
from public.v2_benchmark_results result;

create or replace view public.v2_rpc_subscription_plans_legacy_shape
with (security_invoker = true) as
select plan.*, plan.lab_slug as organisation_id
from public.v2_subscription_plans plan;

create or replace view public.v2_rpc_subscription_models_legacy_shape
with (security_invoker = true) as
select relation.*, relation.model_slug as model_id
from public.v2_subscription_plan_models relation;

create or replace view public.v2_rpc_subscription_features_legacy_shape
with (security_invoker = true) as
select feature.*
from public.v2_subscription_plan_features feature;

grant select on
  public.v2_rpc_labs_legacy_shape,
  public.v2_rpc_models_legacy_shape,
  public.v2_rpc_providers_legacy_shape,
  public.v2_rpc_routes_legacy_shape,
  public.v2_rpc_capabilities_legacy_shape,
  public.v2_rpc_pricing_legacy_shape,
  public.v2_rpc_benchmarks_legacy_shape,
  public.v2_rpc_benchmark_results_legacy_shape,
  public.v2_rpc_subscription_plans_legacy_shape,
  public.v2_rpc_subscription_models_legacy_shape,
  public.v2_rpc_subscription_features_legacy_shape
to anon, authenticated, service_role;

-- Recompile every read-only RPC that still names a replaced V1 catalogue table.
-- Mutation RPCs are intentionally excluded: repository JSON remains the only
-- catalogue authoring path and those endpoints must be migrated explicitly.
do $migration$
declare
  proc record;
  definition text;
begin
  for proc in
    select p.oid, n.nspname, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~ 'public\.data_(models|organisations|api_providers|api_provider_models|api_provider_model_capabilities|api_pricing_rules|api_model_aliases|benchmarks|benchmark_results|subscription_plans|subscription_plan_models|subscription_plan_features)'
  loop
    definition := pg_get_functiondef(proc.oid);
    if definition ~* '(insert\s+into|update|delete\s+from)\s+public\.data_' then
      raise warning 'Leaving catalogue mutation function %.% for explicit JSON-authoring removal', proc.nspname, proc.proname;
      continue;
    end if;

    definition := replace(definition, 'public.data_api_provider_model_capabilities', 'public.v2_rpc_capabilities_legacy_shape');
    definition := replace(definition, 'public.data_api_provider_models', 'public.v2_rpc_routes_legacy_shape');
    definition := replace(definition, 'public.data_api_pricing_rules', 'public.v2_rpc_pricing_legacy_shape');
    definition := replace(definition, 'public.data_api_model_aliases', '(select alias_slug, model_slug as api_model_id, enabled as is_enabled, effective_from, effective_to, metadata, created_at, updated_at from public.v2_model_aliases)');
    definition := replace(definition, 'public.data_api_providers', 'public.v2_rpc_providers_legacy_shape');
    definition := replace(definition, 'public.data_benchmark_results', 'public.v2_rpc_benchmark_results_legacy_shape');
    definition := replace(definition, 'public.data_benchmarks', 'public.v2_rpc_benchmarks_legacy_shape');
    definition := replace(definition, 'public.data_subscription_plan_models', 'public.v2_rpc_subscription_models_legacy_shape');
    definition := replace(definition, 'public.data_subscription_plan_features', 'public.v2_rpc_subscription_features_legacy_shape');
    definition := replace(definition, 'public.data_subscription_plans', 'public.v2_rpc_subscription_plans_legacy_shape');
    definition := replace(definition, 'public.data_organisations', 'public.v2_rpc_labs_legacy_shape');
    definition := replace(definition, 'public.data_models', 'public.v2_rpc_models_legacy_shape');
    raise notice 'Recompiling %.% against V2 catalogue projections', proc.nspname, proc.proname;
    execute definition;
  end loop;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~* '(from|join)\s+(public\.)?data_(models|organisations|api_providers|api_provider_models|api_provider_model_capabilities|api_pricing_rules|api_model_aliases|benchmarks|benchmark_results|subscription_plans|subscription_plan_models|subscription_plan_features)\M'
      and pg_get_functiondef(p.oid) !~* '(insert\s+into|update|delete\s+from)\s+public\.data_'
  ) then
    raise exception 'Read-only RPC catalogue cutover left a V1 table dependency';
  end if;
end
$migration$;
