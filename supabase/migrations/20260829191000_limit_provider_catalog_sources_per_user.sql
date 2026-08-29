create or replace function public.enforce_provider_catalog_source_owner_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.created_by::text, 918273));
  if (
    select count(*)
    from public.provider_catalog_sources source
    where source.created_by = new.created_by
  ) >= 5 then
    raise exception using
      errcode = '23514',
      message = 'provider_catalog_source_owner_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists provider_catalog_source_owner_limit on public.provider_catalog_sources;
create trigger provider_catalog_source_owner_limit
before insert on public.provider_catalog_sources
for each row execute function public.enforce_provider_catalog_source_owner_limit();

revoke all on function public.enforce_provider_catalog_source_owner_limit() from public, anon, authenticated;
