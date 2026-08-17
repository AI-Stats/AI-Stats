-- Run on the Supabase direct connection before creating the publication.
-- Logical replication cannot safely publish UPDATE/DELETE operations for a
-- table without a primary/configured replica-identity index. FULL is the
-- conservative migration-time fallback and may increase source WAL volume.
do $replica_identity$
declare
  relation record;
begin
  for relation in
    select namespace.nspname as schema_name, table_row.relname as table_name
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
      )
    order by namespace.nspname, table_row.relname
  loop
    raise notice 'Setting REPLICA IDENTITY FULL on %.%', relation.schema_name, relation.table_name;
    execute format(
      'alter table %I.%I replica identity full',
      relation.schema_name,
      relation.table_name
    );
  end loop;
end
$replica_identity$;
