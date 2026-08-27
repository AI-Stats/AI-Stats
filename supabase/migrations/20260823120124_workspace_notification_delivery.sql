alter table public.workspace_settings
  add column if not exists model_deprecation_alerts_enabled boolean not null default false;

create table if not exists public.notification_destinations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  type text not null check (type in ('email', 'discord', 'discord_webhook', 'slack', 'microsoft_teams', 'custom_webhook')),
  status text not null default 'active' check (status in ('active', 'disabled', 'deleted')),
  target_ciphertext text not null,
  target_iv text not null,
  target_hash text not null,
  target_key_version text not null default 'v1',
  target_preview text not null,
  is_ephemeral boolean not null default false,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists notification_destinations_workspace_status_idx
  on public.notification_destinations (workspace_id, status, created_at desc);
create unique index if not exists notification_destinations_workspace_target_idx
  on public.notification_destinations (workspace_id, type, target_hash)
  where status <> 'deleted';

alter table public.notification_destinations enable row level security;
revoke all on table public.notification_destinations from anon, authenticated;
grant select, insert, update, delete on public.notification_destinations to service_role;

create table if not exists public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.email_outbox(id) on delete cascade,
  destination_id uuid not null references public.notification_destinations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'retry', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text null,
  response_status integer null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, destination_id)
);

create index if not exists notification_delivery_attempts_pending_idx
  on public.notification_delivery_attempts (status, next_attempt_at, created_at)
  where status in ('pending', 'retry');

alter table public.notification_delivery_attempts enable row level security;
revoke all on table public.notification_delivery_attempts from anon, authenticated;
grant select, insert, update, delete on public.notification_delivery_attempts to service_role;

comment on table public.notification_destinations is
  'Encrypted workspace notification destinations. Decrypted targets are only available to trusted server runtimes.';
comment on table public.notification_delivery_attempts is
  'Deduplicated delivery state and retry history for workspace notification events.';
