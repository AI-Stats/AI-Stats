-- phaseo:allow-destructive-migration reason: SCIM deprovisioning and atomic membership replacement require scoped row deletion.

create table if not exists public.scim_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scim_endpoints_workspace_id_key unique (workspace_id)
);

create table if not exists public.scim_tokens (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.scim_endpoints(id) on delete cascade,
  token_prefix text not null,
  token_hash text not null,
  label text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint scim_tokens_prefix_length_check check (char_length(token_prefix) between 8 and 32),
  constraint scim_tokens_label_length_check check (char_length(label) between 1 and 100),
  constraint scim_tokens_token_prefix_key unique (token_prefix)
);

create table if not exists public.scim_users (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  external_id text,
  user_name text not null,
  user_name_normalized text generated always as (lower(user_name)) stored,
  active boolean not null default true,
  display_name text,
  given_name text,
  family_name text,
  employee_number text,
  cost_center text,
  organization text,
  division text,
  department text,
  manager_scim_user_id uuid,
  emails jsonb not null default '[]'::jsonb,
  phone_numbers jsonb not null default '[]'::jsonb,
  addresses jsonb not null default '[]'::jsonb,
  locale text,
  preferred_language text,
  timezone text,
  title text,
  user_type text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scim_users_workspace_user_name_key unique (workspace_id, user_name_normalized),
  constraint scim_users_workspace_external_id_key unique (workspace_id, external_id),
  constraint scim_users_workspace_auth_user_id_key unique (workspace_id, auth_user_id),
  constraint scim_users_id_workspace_id_key unique (id, workspace_id),
  constraint scim_users_manager_workspace_fkey foreign key (manager_scim_user_id, workspace_id) references public.scim_users(id, workspace_id) on delete set null (manager_scim_user_id),
  constraint scim_users_version_check check (version > 0),
  constraint scim_users_emails_array_check check (jsonb_typeof(emails) = 'array'),
  constraint scim_users_phone_numbers_array_check check (jsonb_typeof(phone_numbers) = 'array'),
  constraint scim_users_addresses_array_check check (jsonb_typeof(addresses) = 'array')
);

create table if not exists public.scim_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_id text,
  display_name text not null,
  display_name_normalized text generated always as (lower(display_name)) stored,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scim_groups_workspace_display_name_key unique (workspace_id, display_name_normalized),
  constraint scim_groups_workspace_external_id_key unique (workspace_id, external_id),
  constraint scim_groups_id_workspace_id_key unique (id, workspace_id),
  constraint scim_groups_version_check check (version > 0)
);

create table if not exists public.scim_group_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  group_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id),
  constraint scim_group_members_group_workspace_fkey foreign key (group_id, workspace_id) references public.scim_groups(id, workspace_id) on delete cascade,
  constraint scim_group_members_user_workspace_fkey foreign key (user_id, workspace_id) references public.scim_users(id, workspace_id) on delete cascade
);

create table if not exists public.scim_audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null,
  endpoint_id uuid,
  token_id uuid,
  request_id text not null,
  correlation_id text,
  action text not null,
  resource_type text,
  resource_id text,
  outcome text not null,
  http_status integer not null,
  scim_type text,
  detail text,
  source_ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint scim_audit_events_outcome_check check (outcome in ('success', 'failure', 'denied')),
  constraint scim_audit_events_http_status_check check (http_status between 100 and 599),
  constraint scim_audit_events_action_length_check check (char_length(action) between 1 and 100)
);

create table if not exists public.scim_idempotency_keys (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint scim_idempotency_keys_workspace_key unique (workspace_id, idempotency_key),
  constraint scim_idempotency_keys_key_length_check check (char_length(idempotency_key) between 1 and 200)
);

create index if not exists scim_tokens_endpoint_id_idx on public.scim_tokens (endpoint_id);
create index if not exists scim_tokens_active_prefix_idx on public.scim_tokens (token_prefix) where revoked_at is null;
create index if not exists scim_users_workspace_active_idx on public.scim_users (workspace_id, active);
create index if not exists scim_users_manager_scim_user_id_idx on public.scim_users (manager_scim_user_id);
create index if not exists scim_groups_workspace_id_idx on public.scim_groups (workspace_id);
create index if not exists scim_group_members_user_id_idx on public.scim_group_members (user_id);
create index if not exists scim_audit_events_workspace_created_at_idx on public.scim_audit_events (workspace_id, created_at desc);
create index if not exists scim_audit_events_endpoint_id_idx on public.scim_audit_events (endpoint_id);
create index if not exists scim_audit_events_token_id_idx on public.scim_audit_events (token_id);
create index if not exists scim_idempotency_keys_expires_at_idx on public.scim_idempotency_keys (expires_at);

create or replace function public.touch_scim_resource()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$;

drop trigger if exists scim_users_touch_resource on public.scim_users;
create trigger scim_users_touch_resource before update on public.scim_users
for each row execute function public.touch_scim_resource();

drop trigger if exists scim_groups_touch_resource on public.scim_groups;
create trigger scim_groups_touch_resource before update on public.scim_groups
for each row execute function public.touch_scim_resource();

create or replace function public.reject_scim_audit_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'SCIM audit events are append-only';
end;
$$;

drop trigger if exists scim_audit_events_append_only on public.scim_audit_events;
create trigger scim_audit_events_append_only
before update or delete on public.scim_audit_events
for each row execute function public.reject_scim_audit_event_mutation();

alter table public.scim_endpoints enable row level security;
alter table public.scim_tokens enable row level security;
alter table public.scim_users enable row level security;
alter table public.scim_groups enable row level security;
alter table public.scim_group_members enable row level security;
alter table public.scim_audit_events enable row level security;
alter table public.scim_idempotency_keys enable row level security;

revoke all on public.scim_endpoints, public.scim_tokens, public.scim_users, public.scim_groups, public.scim_group_members, public.scim_audit_events from anon, authenticated;
revoke all on public.scim_idempotency_keys from anon, authenticated;
grant select, insert, update, delete on public.scim_endpoints, public.scim_tokens, public.scim_users, public.scim_groups, public.scim_group_members to service_role;
grant select, insert on public.scim_audit_events to service_role;
grant select, insert, update, delete on public.scim_idempotency_keys to service_role;
grant usage, select on sequence public.scim_audit_events_id_seq to service_role;
grant usage, select on sequence public.scim_idempotency_keys_id_seq to service_role;

create or replace function public.sync_scim_user_workspace_access()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  existing_role text;
  owner_id uuid;
begin
  if new.auth_user_id is null then return new; end if;
  select owner_user_id into owner_id from public.workspaces where id = new.workspace_id;
  select role into existing_role from public.workspace_members where workspace_id = new.workspace_id and user_id = new.auth_user_id;
  if new.active then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (new.workspace_id, new.auth_user_id, 'member')
    on conflict (workspace_id, user_id) do nothing;
  elsif new.auth_user_id <> owner_id and coalesce(lower(existing_role), 'member') not in ('owner', 'admin') then
    delete from public.workspace_members where workspace_id = new.workspace_id and user_id = new.auth_user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists scim_users_sync_workspace_access on public.scim_users;
create trigger scim_users_sync_workspace_access
after insert or update of active, auth_user_id on public.scim_users
for each row execute function public.sync_scim_user_workspace_access();

revoke all on function public.sync_scim_user_workspace_access() from public, anon, authenticated;

create or replace function public.replace_scim_group_members(
  p_workspace_id uuid,
  p_group_id uuid,
  p_user_ids uuid[]
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.scim_groups where id = p_group_id and workspace_id = p_workspace_id) then
    raise exception 'SCIM group not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_user_ids, '{}'::uuid[])) as candidate(user_id)
    where not exists (select 1 from public.scim_users where id = candidate.user_id and workspace_id = p_workspace_id)
  ) then
    raise exception 'SCIM user not found in workspace' using errcode = '23503';
  end if;
  delete from public.scim_group_members where workspace_id = p_workspace_id and group_id = p_group_id;
  insert into public.scim_group_members (workspace_id, group_id, user_id)
  select p_workspace_id, p_group_id, user_id
  from (select distinct unnest(coalesce(p_user_ids, '{}'::uuid[])) as user_id) users;
end;
$$;

revoke all on function public.replace_scim_group_members(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.replace_scim_group_members(uuid, uuid, uuid[]) to service_role;
revoke all on function public.reject_scim_audit_event_mutation() from public, anon, authenticated;
revoke all on function public.touch_scim_resource() from public, anon, authenticated;

comment on table public.scim_users is 'Workspace-scoped SCIM directory users, separate from login identities until SSO linking.';
comment on table public.scim_audit_events is 'Append-only, sanitized SCIM provisioning audit history. Credentials and request bodies must never be stored here.';
