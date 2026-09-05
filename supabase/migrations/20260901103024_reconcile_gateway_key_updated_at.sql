-- Keep the Gateway key management API aligned with its selected response fields.
alter table public.keys
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.update_key_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.update_key_updated_at() from public, anon, authenticated;

drop trigger if exists keys_set_updated_at on public.keys;
create trigger keys_set_updated_at
before update on public.keys
for each row execute function public.update_key_updated_at();

notify pgrst, 'reload schema';
