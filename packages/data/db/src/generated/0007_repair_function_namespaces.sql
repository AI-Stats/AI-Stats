begin;

create temporary table namespace_relation_map (
  relation_name text primary key,
  target_schema text not null
) on commit drop;

insert into namespace_relation_map (relation_name, target_schema)
select relation.relname, min(namespace.nspname)
from pg_class relation
join pg_namespace namespace on namespace.oid = relation.relnamespace
where relation.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
  and namespace.nspname in (
    'app', 'auth', 'billing', 'catalog', 'content', 'gateway',
    'internal', 'observability'
  )
  and to_regclass(format('public.%I', relation.relname)) is null
group by relation.relname
having count(*) = 1;

-- `public.users` was the Phaseo profile table. Supabase identities have always
-- lived at auth.users, so the plural-name collision has a deterministic target.
insert into namespace_relation_map (relation_name, target_schema)
values ('users', 'app')
on conflict (relation_name) do update set target_schema = excluded.target_schema;

do $$
declare
  function_record record;
  mapping_record record;
  original_definition text;
  repaired_definition text;
begin
  for function_record in
    select procedure.oid
    from pg_proc procedure
    where procedure.prokind in ('f', 'p')
    order by procedure.oid
  loop
    original_definition := pg_get_functiondef(function_record.oid);
    repaired_definition := original_definition;

    for mapping_record in
      select relation_name, target_schema
      from namespace_relation_map
      order by length(relation_name) desc, relation_name
    loop
      repaired_definition := regexp_replace(
        repaired_definition,
        'public\.' || mapping_record.relation_name || '\M',
        quote_ident(mapping_record.target_schema) || '.' || quote_ident(mapping_record.relation_name),
        'g'
      );
    end loop;

    if repaired_definition <> original_definition then
      execute repaired_definition;
    end if;
  end loop;
end
$$;

-- Partition maintenance is obsolete after 0006 consolidated the active
-- gateway request parents into ordinary tables.
drop function if exists public.ensure_gateway_requests_partitions(integer);

do $$
declare
  unresolved_count integer;
  unresolved_names text;
begin
  with function_tokens as (
    select procedure.oid,
           (regexp_matches(
             pg_get_functiondef(procedure.oid),
             'public\.([a-zA-Z_][a-zA-Z0-9_]*)',
             'g'
           ))[1] relation_name
    from pg_proc procedure
    where procedure.prokind in ('f', 'p')
  )
  select count(*), string_agg(distinct token.relation_name, ', ' order by token.relation_name)
    into unresolved_count, unresolved_names
  from function_tokens token
  join namespace_relation_map mapping using (relation_name)
  where pg_get_functiondef(token.oid) ~ ('public\.' || token.relation_name || '\M');

  if unresolved_count <> 0 then
    raise exception 'namespace repair left % stale mapped relation references: %', unresolved_count, unresolved_names;
  end if;
end
$$;

commit;
