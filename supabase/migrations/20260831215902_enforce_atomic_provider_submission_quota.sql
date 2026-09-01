-- Reserve provider-onboarding submission slots atomically per user.
-- The advisory lock serializes concurrent requests before the quota count
-- and reservation insert, so parallel submissions cannot overrun the limit.
create table if not exists public.provider_onboarding_submission_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists provider_onboarding_submission_reservations_user_idx
  on public.provider_onboarding_submission_reservations (user_id, created_at desc);

alter table public.provider_onboarding_submission_reservations enable row level security;
revoke all on public.provider_onboarding_submission_reservations from anon, authenticated;

create or replace function public.reserve_provider_onboarding_submission_slot(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_count integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*)::integer
    into reservation_count
    from public.provider_onboarding_submission_reservations
   where user_id = p_user_id
     and created_at >= now() - interval '24 hours';

  if reservation_count >= 5 then
    return false;
  end if;

  insert into public.provider_onboarding_submission_reservations (user_id)
  values (p_user_id);
  return true;
end;
$$;

revoke all on function public.reserve_provider_onboarding_submission_slot(uuid) from public;
grant execute on function public.reserve_provider_onboarding_submission_slot(uuid) to authenticated, service_role;
