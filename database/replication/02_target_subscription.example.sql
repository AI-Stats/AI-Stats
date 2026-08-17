-- Run on PlanetScale with a migration role that has pg_create_subscription.
-- Replace every placeholder locally. Never save the rendered file or command.
-- The target application tables must be empty. copy_data=true gives the initial
-- copy and subsequent WAL stream one consistent source snapshot; row-count
-- parity alone cannot make a previous dump safe for copy_data=false.
do $empty_target$
declare
  relation record;
  contains_rows boolean;
begin
  for relation in
    select schemaname, tablename
    from pg_catalog.pg_tables
    where schemaname = 'public' or (schemaname = 'auth' and tablename = 'users')
    order by schemaname, tablename
  loop
    execute format(
      'select exists (select 1 from %I.%I limit 1)',
      relation.schemaname,
      relation.tablename
    ) into contains_rows;
    if contains_rows then
      raise exception 'Target relation %.% is not empty', relation.schemaname, relation.tablename;
    end if;
  end loop;
end
$empty_target$;

create subscription phaseo_from_supabase
connection 'host=<SUPABASE_DIRECT_IPV4_HOST> port=5432 dbname=<DATABASE> user=<REPLICATION_USER> password=<PASSWORD> sslmode=require'
publication phaseo_to_planetscale
with (
  copy_data = true,
  create_slot = true,
  enabled = true
);
