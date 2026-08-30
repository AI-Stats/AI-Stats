create or replace function public.reorder_workspace_byok_credentials(
  p_workspace_id uuid,
  p_provider_id text,
  p_routing_mode text,
  p_key_ids uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_count integer;
  supplied_count integer;
begin
  if p_routing_mode not in ('priority', 'fallback') then
    return false;
  end if;

  select count(*) into expected_count
  from public.byok_keys
  where workspace_id = p_workspace_id
    and provider_id = p_provider_id
    and routing_mode = p_routing_mode;

  select count(distinct key_id) into supplied_count
  from unnest(p_key_ids) as key_id;

  if expected_count = 0
    or supplied_count <> expected_count
    or cardinality(p_key_ids) <> expected_count
    or exists (
      select 1
      from unnest(p_key_ids) as supplied(key_id)
      left join public.byok_keys credential
        on credential.id = supplied.key_id
        and credential.workspace_id = p_workspace_id
        and credential.provider_id = p_provider_id
        and credential.routing_mode = p_routing_mode
      where credential.id is null
    )
  then
    return false;
  end if;

  update public.byok_keys credential
  set sort_order = ordered.ordinality - 1
  from unnest(p_key_ids) with ordinality as ordered(key_id, ordinality)
  where credential.id = ordered.key_id
    and credential.workspace_id = p_workspace_id;

  return true;
end;
$$;

revoke all on function public.reorder_workspace_byok_credentials(uuid, text, text, uuid[]) from public;
revoke all on function public.reorder_workspace_byok_credentials(uuid, text, text, uuid[]) from anon;
revoke all on function public.reorder_workspace_byok_credentials(uuid, text, text, uuid[]) from authenticated;
grant execute on function public.reorder_workspace_byok_credentials(uuid, text, text, uuid[]) to service_role;

create or replace function public.enforce_byok_key_provider_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  existing_provider_count integer;
  existing_mode_count integer;
  excluded_key_id uuid;
begin
  if tg_op = 'UPDATE'
    and new.workspace_id is not distinct from old.workspace_id
    and new.provider_id is not distinct from old.provider_id
    and new.routing_mode is not distinct from old.routing_mode then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    excluded_key_id := old.id;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.workspace_id::text || ':' || new.provider_id, 0)
  );

  select
    count(*),
    count(*) filter (where routing_mode = new.routing_mode)
  into existing_provider_count, existing_mode_count
  from public.byok_keys
  where workspace_id = new.workspace_id
    and provider_id = new.provider_id
    and (excluded_key_id is null or id <> excluded_key_id);

  if existing_provider_count >= 32 then
    raise exception 'BYOK key limit reached for workspace provider'
      using errcode = '23514';
  end if;
  if existing_mode_count >= 16 then
    raise exception 'BYOK key routing-mode limit reached for workspace provider'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_byok_key_provider_limit() from public, anon, authenticated;

drop trigger if exists enforce_byok_key_provider_limit on public.byok_keys;
create trigger enforce_byok_key_provider_limit
before insert or update of workspace_id, provider_id, routing_mode on public.byok_keys
for each row execute function public.enforce_byok_key_provider_limit();
