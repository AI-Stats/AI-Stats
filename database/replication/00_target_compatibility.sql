-- Run on a clean PlanetScale target after restoring the Supabase application
-- schema and before granting the runtime role access. PlanetScale requests are
-- authorized by the application repositories, not Supabase JWT-backed RLS.
do $target_rls$
declare
  relation record;
begin
  for relation in
    select schemaname, tablename
    from pg_catalog.pg_tables
    where schemaname in ('public', 'auth')
    order by schemaname, tablename
  loop
    execute format(
      'alter table %I.%I disable row level security',
      relation.schemaname,
      relation.tablename
    );
  end loop;
end
$target_rls$;

-- The Supabase-only signup trigger is not used by Better Auth. Its replacement
-- provisioning and lifecycle notification run in the application post-login
-- path. Remove the imported function if no target trigger references it.
do $signup_function$
declare
  function_oid oid := to_regprocedure('public.enqueue_welcome_email()');
begin
  if function_oid is not null
     and not exists (
       select 1
       from pg_catalog.pg_trigger trigger_row
       where trigger_row.tgfoid = function_oid
         and not trigger_row.tgisinternal
     ) then
    drop function public.enqueue_welcome_email();
  end if;
end
$signup_function$;

-- Supabase was created with ICU en-US collation, while PlanetScale's managed
-- database uses libc en_US.UTF-8. Keep the ordering of capped RPC result sets
-- stable across both databases so the cutover cannot select a different first
-- page of rows.
do $icu_rpc_ordering$
declare
  function_oid oid;
  definition text;
begin
  foreach function_oid in array array[
    to_regprocedure('public.get_monitor_model_rows(boolean)'),
    to_regprocedure('public.get_monitor_history_page(text,text,text,integer,integer)')
  ]
  loop
    if function_oid is null then
      continue;
    end if;
    definition := pg_get_functiondef(function_oid);
    definition := replace(definition, 'pm.provider_api_model_id asc, cap.capability_id asc', 'pm.provider_api_model_id COLLATE "en-US-x-icu" asc, cap.capability_id COLLATE "en-US-x-icu" asc');
    definition := replace(definition, 'filtered.commit_sha desc', 'filtered.commit_sha COLLATE "en-US-x-icu" desc');
    definition := replace(definition, 'e.event_id asc', 'e.event_id COLLATE "en-US-x-icu" asc');
    execute definition;
  end loop;
end
$icu_rpc_ordering$;
