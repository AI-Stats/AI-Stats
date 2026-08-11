-- phaseo:allow-destructive-migration reason: Removes public compatibility views after callers move to authoritative V2 sources.
-- Keep the compatibility projections available only to existing database
-- functions while removing their public/Data API surface. Application code
-- must read the V2 tables directly.
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to service_role;

do $migration$
declare
  source_name text;
  target_name text;
  definition text;
  source_names text[] := array[
    'v2_rpc_benchmark_results_legacy_shape',
    'v2_rpc_benchmarks_legacy_shape',
    'v2_rpc_capabilities_legacy_shape',
    'v2_rpc_gateway_requests_legacy_shape',
    'v2_rpc_labs_legacy_shape',
    'v2_rpc_models_legacy_shape',
    'v2_rpc_pricing_legacy_shape',
    'v2_rpc_providers_legacy_shape',
    'v2_rpc_routes_legacy_shape',
    'v2_rpc_subscription_features_legacy_shape',
    'v2_rpc_subscription_models_legacy_shape',
    'v2_rpc_subscription_plans_legacy_shape'
  ];
begin
  set local search_path = public;

  foreach source_name in array source_names loop
    target_name := replace(source_name, '_legacy_shape', '_compat');
    select pg_get_viewdef(format('public.%I', source_name)::regclass, true)
      into definition;
    execute format(
      'create view private.%I with (security_invoker = true) as %s',
      target_name,
      definition
    );
    execute format(
      'grant select on private.%I to service_role',
      target_name
    );
  end loop;

  -- v2_web_gateway_requests is the only public view that still depends on
  -- the gateway request compatibility projection.
  definition := pg_get_viewdef('public.v2_web_gateway_requests'::regclass, true);
  definition := replace(definition, 'v2_rpc_gateway_requests_legacy_shape', 'private.v2_rpc_gateway_requests_compat');
  execute 'create or replace view public.v2_web_gateway_requests with (security_invoker = true) as ' || definition;

  -- Recompile database functions against the private projections before the
  -- public compatibility views are removed.
  for source_name in
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and exists (
        select 1
        from unnest(source_names) as view_name
        where pg_get_functiondef(p.oid) like '%' || ('public.' || view_name) || '%'
      )
  loop
    definition := pg_get_functiondef(source_name::regprocedure);
    foreach target_name in array source_names loop
      definition := replace(
        definition,
        'public.' || target_name,
        'private.' || replace(target_name, '_legacy_shape', '_compat')
      );
    end loop;
    execute definition;
  end loop;
end
$migration$;

drop view public.v2_rpc_benchmark_results_legacy_shape;
drop view public.v2_rpc_benchmarks_legacy_shape;
drop view public.v2_rpc_capabilities_legacy_shape;
drop view public.v2_rpc_gateway_requests_legacy_shape;
drop view public.v2_rpc_labs_legacy_shape;
drop view public.v2_rpc_models_legacy_shape;
drop view public.v2_rpc_pricing_legacy_shape;
drop view public.v2_rpc_providers_legacy_shape;
drop view public.v2_rpc_routes_legacy_shape;
drop view public.v2_rpc_subscription_features_legacy_shape;
drop view public.v2_rpc_subscription_models_legacy_shape;
drop view public.v2_rpc_subscription_plans_legacy_shape;

do $assert$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) like '%public.v2_rpc_%_legacy_shape%'
  ) then
    raise exception 'Public SQL functions still reference removed compatibility views';
  end if;

  if to_regclass('public.v2_rpc_models_legacy_shape') is not null
     or to_regclass('public.v2_rpc_gateway_requests_legacy_shape') is not null then
    raise exception 'Public compatibility views remain after internalization';
  end if;
end
$assert$;
