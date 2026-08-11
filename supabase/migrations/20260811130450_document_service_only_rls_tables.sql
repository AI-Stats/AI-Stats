-- These RLS-enabled tables intentionally have no client grants and are used
-- only by service-role application paths. Add an explicit policy documenting
-- that access model so future reviews do not mistake them for incomplete RLS.
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
      'create policy service_role_full_access on %I.%I for all to service_role using (true) with check (true)',
      target.schema_name,
      target.table_name
    );
  end loop;
end;
$$;
