-- Make hard Auth deletion the authoritative database purge. Owned workspaces
-- already cascade through customer data; these older constraints were the
-- remaining blockers or would unnecessarily delete shared-workspace records.

alter table public.oauth_app_metadata alter column created_by drop not null;
alter table public.oauth_app_metadata drop constraint if exists oauth_app_metadata_created_by_fkey;
alter table public.oauth_app_metadata add constraint oauth_app_metadata_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.provider_catalog_review_events alter column actor_user_id drop not null;
alter table public.provider_catalog_review_events drop constraint if exists provider_catalog_review_events_actor_user_id_fkey;
alter table public.provider_catalog_review_events add constraint provider_catalog_review_events_actor_user_id_fkey
  foreign key (actor_user_id) references auth.users(id) on delete set null;

alter table public.v2_catalogue_admin_changes alter column actor_user_id drop not null;
alter table public.v2_catalogue_admin_changes drop constraint if exists v2_catalogue_admin_changes_actor_user_id_fkey;
alter table public.v2_catalogue_admin_changes add constraint v2_catalogue_admin_changes_actor_user_id_fkey
  foreign key (actor_user_id) references auth.users(id) on delete set null;

alter table public.v2_catalogue_source_overrides alter column actor_user_id drop not null;
alter table public.v2_catalogue_source_overrides drop constraint if exists v2_catalogue_source_overrides_actor_user_id_fkey;
alter table public.v2_catalogue_source_overrides add constraint v2_catalogue_source_overrides_actor_user_id_fkey
  foreign key (actor_user_id) references auth.users(id) on delete set null;

alter table public.management_keys alter column created_by drop not null;
alter table public.management_keys drop constraint if exists management_keys_created_by_fkey;
alter table public.management_keys add constraint management_keys_created_by_fkey
  foreign key (created_by) references public.users(user_id) on delete set null;
alter table public.management_keys drop constraint if exists management_keys_workspace_id_fkey;
alter table public.management_keys add constraint management_keys_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table public.presets alter column created_by drop not null;
alter table public.presets drop constraint if exists presets_created_by_fkey;
alter table public.presets add constraint presets_created_by_fkey
  foreign key (created_by) references public.users(user_id) on delete set null;
alter table public.presets drop constraint if exists presets_workspace_id_fkey;
alter table public.presets add constraint presets_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table public.preset_versions alter column created_by drop not null;
alter table public.preset_versions drop constraint if exists preset_versions_created_by_fkey;
alter table public.preset_versions add constraint preset_versions_created_by_fkey
  foreign key (created_by) references public.users(user_id) on delete set null;

-- The row survives Auth deletion long enough for the Gateway Worker to purge
-- Cloudflare R2 and KV. Identifiers are cleared when the purge completes; the
-- remaining row is non-identifying operational evidence of deadline compliance.
create table if not exists public.account_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  workspace_ids uuid[] not null default '{}',
  key_ids uuid[] not null default '{}',
  key_kids text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'purging', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  deadline_at timestamptz not null default (now() + interval '30 days'),
  lease_expires_at timestamptz,
  last_attempt_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  r2_objects_deleted integer not null default 0 check (r2_objects_deleted >= 0),
  kv_keys_deleted integer not null default 0 check (kv_keys_deleted >= 0),
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deadline_at <= requested_at + interval '30 days'),
  check ((status = 'completed') = (completed_at is not null))
);

create unique index if not exists account_deletion_jobs_active_user_uidx
  on public.account_deletion_jobs (user_id)
  where user_id is not null and status <> 'completed';

create index if not exists account_deletion_jobs_pending_idx
  on public.account_deletion_jobs (status, deadline_at, requested_at)
  where status in ('pending', 'purging', 'failed');

alter table public.account_deletion_jobs enable row level security;
revoke all on table public.account_deletion_jobs from anon, authenticated;
grant select, insert, update, delete on table public.account_deletion_jobs to service_role;

comment on table public.account_deletion_jobs is
  'Service-role-only queue for completing account deletion across Cloudflare stores within 30 days.';

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
      and (job.lease_expires_at is null or job.lease_expires_at <= now())
      and job.completed_at is null
    order by job.deadline_at asc, job.requested_at asc
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
