-- Database-owned proof that the legacy catalogue can be removed safely.
-- This intentionally does not drop anything. The destructive migration must
-- call assert_v2_catalogue_cutover_ready() immediately before its DROP TABLEs.

create or replace function public.get_v2_catalogue_cutover_preflight()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  legacy_tables constant text[] := array[
    'data_api_model_aliases',
    'data_api_model_page_notices',
    'data_api_pricing_rules',
    'data_api_pricing_skus',
    'data_api_provider_model_capabilities',
    'data_api_provider_models',
    'data_api_providers',
    'data_benchmark_results',
    'data_benchmarks',
    'data_model_details',
    'data_model_families',
    'data_model_links',
    'data_models',
    'data_organisation_links',
    'data_organisations',
    'data_subscription_plan_features',
    'data_subscription_plan_models',
    'data_subscription_plans'
  ];
  dependency_rows jsonb;
  count_rows jsonb;
  unresolved_pricing integer;
  missing_tables text[];
  dependency_count integer;
begin
  select coalesce(array_agg(name order by name), '{}'::text[])
  into missing_tables
  from unnest(legacy_tables) name
  where to_regclass('public.' || name) is null;

  with legacy as (
    select class.oid, class.relname
    from pg_class class
    join pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = any(legacy_tables)
  ), dependencies as (
    select distinct
      legacy.relname as legacy_table,
      'view'::text as dependency_kind,
      dependent_namespace.nspname || '.' || dependent.relname as dependency_name
    from legacy
    join pg_depend dependency on dependency.refobjid = legacy.oid
    join pg_rewrite rewrite on rewrite.oid = dependency.objid
    join pg_class dependent on dependent.oid = rewrite.ev_class and dependent.oid <> legacy.oid
    join pg_namespace dependent_namespace on dependent_namespace.oid = dependent.relnamespace
    union
    select distinct
      legacy.relname,
      'foreign_key',
      constraint_namespace.nspname || '.' || con.conname
    from legacy
    join pg_constraint con on con.confrelid = legacy.oid
      and not exists (select 1 from legacy owner where owner.oid = con.conrelid)
    join pg_namespace constraint_namespace on constraint_namespace.oid = con.connamespace
    union
    select distinct
      legacy.relname,
      'function_text',
      function_namespace.nspname || '.' || proc.proname || '(' || pg_get_function_identity_arguments(proc.oid) || ')'
    from legacy
    join pg_proc proc on proc.prokind = 'f'
      and case when proc.prokind = 'f' then pg_get_functiondef(proc.oid) else '' end ilike '%' || legacy.relname || '%'
    join pg_namespace function_namespace on function_namespace.oid = proc.pronamespace
    where function_namespace.nspname not in ('pg_catalog', 'information_schema')
      and proc.proname not in ('get_v2_catalogue_cutover_preflight', 'assert_v2_catalogue_cutover_ready')
  )
  select coalesce(jsonb_agg(to_jsonb(dependencies) order by legacy_table, dependency_kind, dependency_name), '[]'::jsonb),
    count(*)
  into dependency_rows, dependency_count
  from dependencies;

  select count(*) into unresolved_pricing
  from public.v2_catalogue_backfill_issues
  where source_type = 'pricing_rule'
    and issue_code = 'unresolved_provider_model';

  select jsonb_build_object(
    'legacy_models', (select count(*) from public.data_models),
    'v2_models', (select count(*) from public.v2_models),
    'legacy_routes', (select count(*) from public.data_api_provider_models),
    'v2_routes', (select count(*) from public.v2_model_provider_routes),
    'legacy_pricing_rules', (select count(*) from public.data_api_pricing_rules),
    'v2_pricing_offers', (select count(*) from public.v2_pricing_skus),
    'v2_pricing_rates', (select count(*) from public.v2_pricing_sku_meters),
    'v2_meter_definitions', (select count(*) from public.v2_meter_definitions),
    'legacy_benchmark_results', (select count(*) from public.data_benchmark_results),
    'v2_benchmark_results', (select count(*) from public.v2_benchmark_results),
    'gateway_requests', (select count(*) from public.gateway_requests),
    'v2_request_facts', (select count(*) from public.v2_request_facts)
  ) into count_rows;

  return jsonb_build_object(
    'ready', cardinality(missing_tables) = 0
      and dependency_count = 0
      and unresolved_pricing = 0
      and (count_rows->>'legacy_routes')::bigint = (count_rows->>'v2_routes')::bigint
      and (count_rows->>'legacy_benchmark_results')::bigint = (count_rows->>'v2_benchmark_results')::bigint
      and (count_rows->>'gateway_requests')::bigint = (count_rows->>'v2_request_facts')::bigint,
    'legacy_tables', legacy_tables,
    'missing_legacy_tables', missing_tables,
    'dependencies', dependency_rows,
    'dependency_count', dependency_count,
    'unresolved_pricing', unresolved_pricing,
    'counts', count_rows,
    'operational_tables_preserved', jsonb_build_array(
      'gateway_requests',
      'gateway_upstream_requests',
      'gateway_io_logs',
      'gateway_feedback',
      'gateway_async_operations',
      'gateway_batch_requests',
      'gateway_realtime_sessions',
      'gateway_request_charges',
      'gateway_wallet_reservations',
      'credit_ledger',
      'monitor_history_events',
      'data_contributions',
      'data_contribution_consent_events'
    )
  );
end;
$$;

create or replace function public.assert_v2_catalogue_cutover_ready()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  report jsonb;
begin
  report := public.get_v2_catalogue_cutover_preflight();
  if not coalesce((report->>'ready')::boolean, false) then
    raise exception 'V2 catalogue cutover preflight failed: %', report using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.get_v2_catalogue_cutover_preflight() from public, anon, authenticated;
revoke all on function public.assert_v2_catalogue_cutover_ready() from public, anon, authenticated;
grant execute on function public.get_v2_catalogue_cutover_preflight() to service_role;
grant execute on function public.assert_v2_catalogue_cutover_ready() to service_role;

comment on function public.get_v2_catalogue_cutover_preflight() is
  'Reports row parity, unresolved pricing, and database dependencies before legacy catalogue removal.';
