-- Complete the self-serve provider catalog loop.
-- Canonical models remain Phaseo-owned. Provider claims may be auto-approved
-- when they resolve exactly or through an enabled alias.

alter table public.provider_catalog_sync_models
  add column if not exists canonical_model_slug text references public.v2_models(model_slug) on delete set null,
  add column if not exists match_type text,
  add column if not exists availability text not null default 'ready',
  add column if not exists available_from timestamptz,
  add column if not exists deprecated_at timestamptz,
  add column if not exists shutdown_at timestamptz,
  add column if not exists route_projection_status text not null default 'not_projected',
  add column if not exists route_projection_error text;

alter table public.provider_catalog_sync_models
  drop constraint if exists provider_catalog_sync_models_match_type_check,
  add constraint provider_catalog_sync_models_match_type_check
    check (match_type is null or match_type in ('exact', 'alias', 'new_model')),
  drop constraint if exists provider_catalog_sync_models_availability_check,
  add constraint provider_catalog_sync_models_availability_check
    check (availability in ('ready', 'not_ready', 'degraded', 'deprecated', 'retired')),
  drop constraint if exists provider_catalog_sync_models_route_projection_check,
  add constraint provider_catalog_sync_models_route_projection_check
    check (route_projection_status in ('not_projected', 'staged', 'probe_passed', 'enabled', 'failed'));

alter table public.provider_catalog_models
  add column if not exists canonical_model_slug text references public.v2_models(model_slug) on delete set null,
  add column if not exists availability text not null default 'ready',
  add column if not exists available_from timestamptz,
  add column if not exists deprecated_at timestamptz,
  add column if not exists shutdown_at timestamptz;

alter table public.provider_catalog_models
  drop constraint if exists provider_catalog_models_availability_check,
  add constraint provider_catalog_models_availability_check
    check (availability in ('ready', 'not_ready', 'degraded', 'deprecated', 'retired'));

alter table public.provider_catalog_sources
  alter column poll_interval_seconds set default 21600;
update public.provider_catalog_sources set poll_interval_seconds = 21600 where poll_interval_seconds = 900;

create table if not exists public.provider_catalog_events (
  id uuid primary key default gen_random_uuid(),
  provider_slug text not null references public.v2_providers(provider_slug) on delete cascade,
  run_id uuid references public.provider_catalog_sync_runs(id) on delete cascade,
  account_user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  event_type text not null,
  title text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint provider_catalog_events_type_check check (event_type in (
    'catalog_applied', 'catalog_needs_changes', 'model_auto_approved',
    'model_approved', 'model_rejected', 'model_needs_changes', 'route_staged'
  ))
);

create index if not exists provider_catalog_events_account_idx
  on public.provider_catalog_events (account_user_id, created_at desc);
create index if not exists provider_catalog_events_workspace_idx
  on public.provider_catalog_events (workspace_id, created_at desc);
alter table public.provider_catalog_events enable row level security;
revoke all on public.provider_catalog_events from anon, authenticated;
grant select, insert, update on public.provider_catalog_events to service_role;

comment on table public.provider_catalog_events is
  'Provider-facing catalog workflow notification outbox. Delivery channels can consume these events later.';
comment on column public.provider_catalog_sync_models.route_projection_status is
  'Approved claims are staged as disabled routes; only a successful endpoint probe may enable routing.';
