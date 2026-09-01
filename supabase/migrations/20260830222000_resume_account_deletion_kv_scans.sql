-- Persist KV list progress so a large shared namespace cannot force every
-- account-deletion attempt to rescan the same leading keys forever.

alter table public.account_deletion_jobs
  add column if not exists kv_scan_cursor text,
  add column if not exists next_attempt_at timestamptz not null default now();

create index if not exists account_deletion_jobs_retry_idx
  on public.account_deletion_jobs (next_attempt_at, deadline_at, requested_at)
  where status in ('pending', 'purging', 'failed');

create or replace function public.claim_account_deletion_jobs(
  p_limit integer default 5,
  p_lease_seconds integer default 300
)
returns setof public.account_deletion_jobs
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select job.id
    from public.account_deletion_jobs as job
    where job.status in ('pending', 'purging', 'failed')
      and job.next_attempt_at <= now()
      and (job.lease_expires_at is null or job.lease_expires_at <= now())
      and job.completed_at is null
    order by job.deadline_at asc, job.next_attempt_at asc, job.requested_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 25))
  )
  update public.account_deletion_jobs as job
  set status = 'purging',
      lease_expires_at = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 300), 900))),
      last_attempt_at = now(),
      attempts = job.attempts + 1,
      last_error = null,
      updated_at = now()
  from candidates
  where job.id = candidates.id
  returning job.*;
end;
$$;

revoke all on function public.claim_account_deletion_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_account_deletion_jobs(integer, integer) to service_role;
