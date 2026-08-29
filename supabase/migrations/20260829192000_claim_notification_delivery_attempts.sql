alter table public.notification_delivery_attempts
  add column if not exists claim_token uuid null,
  add column if not exists claimed_at timestamptz null;

alter table public.notification_delivery_attempts
  drop constraint if exists notification_delivery_attempts_status_check;
alter table public.notification_delivery_attempts
  add constraint notification_delivery_attempts_status_check
  check (status in ('pending', 'retry', 'processing', 'sent', 'failed'));

create or replace function public.claim_notification_delivery_attempts(p_limit integer default 25)
returns table (id uuid, event_id uuid, destination_id uuid, attempts integer, claim_token uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'invalid_notification_delivery_claim_limit';
  end if;

  return query
  with candidates as (
    select attempt.id
    from public.notification_delivery_attempts attempt
    where (
      attempt.status in ('pending', 'retry')
      and attempt.next_attempt_at <= now()
    ) or (
      attempt.status = 'processing'
      and attempt.claimed_at < now() - interval '5 minutes'
    )
    order by attempt.created_at, attempt.id
    for update skip locked
    limit p_limit
  )
  update public.notification_delivery_attempts attempt
  set status = 'processing',
      claim_token = gen_random_uuid(),
      claimed_at = now(),
      updated_at = now()
  from candidates
  where attempt.id = candidates.id
  returning attempt.id, attempt.event_id, attempt.destination_id, attempt.attempts, attempt.claim_token;
end;
$$;

revoke all on function public.claim_notification_delivery_attempts(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_delivery_attempts(integer) to service_role;
