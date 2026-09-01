alter table public.management_keys
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists daily_limit_requests bigint not null default 0,
  add column if not exists weekly_limit_requests bigint not null default 0,
  add column if not exists monthly_limit_requests bigint not null default 0,
  add column if not exists daily_limit_cost_nanos bigint not null default 0,
  add column if not exists weekly_limit_cost_nanos bigint not null default 0,
  add column if not exists monthly_limit_cost_nanos bigint not null default 0;

create or replace function public.update_management_key_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.update_management_key_updated_at() from public, anon, authenticated;

drop trigger if exists management_keys_set_updated_at on public.management_keys;
create trigger management_keys_set_updated_at
before update on public.management_keys
for each row execute function public.update_management_key_updated_at();
