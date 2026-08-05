create or replace function public.enforce_byok_key_provider_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  existing_key_count integer;
  excluded_key_id uuid;
begin
  if tg_op = 'UPDATE'
    and new.workspace_id is not distinct from old.workspace_id
    and new.provider_id is not distinct from old.provider_id then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    excluded_key_id := old.id;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.workspace_id::text || ':' || new.provider_id, 0)
  );

  select count(*)
  into existing_key_count
  from public.byok_keys
  where workspace_id = new.workspace_id
    and provider_id = new.provider_id
    and (excluded_key_id is null or id <> excluded_key_id);

  if existing_key_count >= 32 then
    raise exception 'BYOK key limit reached for workspace provider'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_byok_key_provider_limit() from public, anon, authenticated;

drop trigger if exists enforce_byok_key_provider_limit on public.byok_keys;
create trigger enforce_byok_key_provider_limit
before insert or update of workspace_id, provider_id on public.byok_keys
for each row execute function public.enforce_byok_key_provider_limit();

comment on function public.enforce_byok_key_provider_limit() is
  'Caps stored BYOK credentials at 32 per workspace/provider using a transaction-scoped advisory lock.';
