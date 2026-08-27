-- These RPCs expose internal cost and low-volume operational telemetry. Public
-- web routes apply aggregation and cohort suppression before returning data.
do $$
declare
  target regprocedure;
begin
  for target in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_v2_model_effective_pricing_daily',
        'get_v2_model_provider_health_metrics',
        'get_v2_model_cached_input_metrics'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', target);
    execute format('grant execute on function %s to service_role', target);
  end loop;
end;
$$;
