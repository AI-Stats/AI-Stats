-- Run on the Supabase direct connection, never through the pooler.
-- Review the preflight result before creating the publication. Any returned
-- table needs a primary/unique replica identity or REPLICA IDENTITY FULL.
do $identity_preflight$
declare
  missing text;
begin
  select string_agg(format('%I.%I', namespace.nspname, table_row.relname), ', ' order by namespace.nspname, table_row.relname)
  into missing
  from pg_catalog.pg_class table_row
  join pg_catalog.pg_namespace namespace on namespace.oid = table_row.relnamespace
  where (namespace.nspname = 'public'
      or (namespace.nspname = 'auth' and table_row.relname = 'users'))
    and table_row.relkind in ('r', 'p')
    and table_row.relreplident <> 'f'
    and not exists (
      select 1
      from pg_catalog.pg_index index_row
      where index_row.indrelid = table_row.oid
        and (index_row.indisprimary or index_row.indisreplident)
    );

  if missing is not null then
    raise exception 'Replica identity missing for: %. Run 00_source_replica_identity_full.sql first.', missing;
  end if;
end
$identity_preflight$;

do $publication$
declare
  relation_list text;
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'phaseo_to_planetscale') then
    raise exception 'Publication phaseo_to_planetscale already exists';
  end if;

  select string_agg(format('%I.%I', schemaname, tablename), ', ' order by schemaname, tablename)
  into relation_list
  from pg_catalog.pg_tables
  where schemaname = 'public';

  if relation_list is null then
    raise exception 'No public tables found';
  end if;

  if to_regclass('auth.users') is null then
    raise exception 'auth.users is required for existing application foreign keys';
  end if;

  -- Only the stable user ID is retained from Supabase Auth. Better Auth users,
  -- credentials, and provider accounts are reconciled by the identity importer;
  -- Supabase sessions and tokens are intentionally not migrated.
  execute 'create publication phaseo_to_planetscale for table '
    || relation_list || ', auth.users (id)';
end
$publication$;
