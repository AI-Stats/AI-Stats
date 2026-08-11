-- Pin caller-independent resolution for application-owned public functions.
-- Keeping public first preserves existing unqualified references while placing
-- pg_temp after it to prevent temporary-object shadowing.
do $$
declare
  target record;
begin
  for target in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, '{}'::text[])) config
        where config like 'search_path=%'
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path to public, pg_temp',
      target.schema_name,
      target.function_name,
      target.identity_arguments
    );
  end loop;
end;
$$;

-- Trigger and event-trigger functions are internal entry points. The trigger
-- owner can still execute them, but Data API roles cannot call them as RPCs.
do $$
declare
  target record;
begin
  for target in
    select distinct
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (
        exists (
          select 1
          from pg_trigger trigger_object
          where trigger_object.tgfoid = p.oid
            and not trigger_object.tgisinternal
        )
        or exists (
          select 1
          from pg_event_trigger event_trigger
          where event_trigger.evtfoid = p.oid
        )
      )
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      target.schema_name,
      target.function_name,
      target.identity_arguments
    );
  end loop;
end;
$$;

-- RLS tables with no policies are intentionally service-only. Remove redundant
-- Data API grants so they remain closed even if a permissive policy is added
-- accidentally in a later migration.
do $$
declare
  target record;
begin
  for target in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
      and not exists (
        select 1
        from pg_policy policy
        where policy.polrelid = c.oid
      )
  loop
    execute format(
      'revoke all on table %I.%I from public, anon, authenticated',
      target.schema_name,
      target.table_name
    );
  end loop;
end;
$$;
