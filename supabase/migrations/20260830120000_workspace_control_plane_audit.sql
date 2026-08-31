create table public.workspace_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  actor_user_id uuid,
  action text not null,
  target_type text not null,
  target_id text not null,
  target_name text,
  metadata jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now(),
  constraint workspace_audit_events_action_length check (char_length(action) between 1 and 100),
  constraint workspace_audit_events_target_type_length check (char_length(target_type) between 1 and 60),
  constraint workspace_audit_events_target_id_length check (char_length(target_id) between 1 and 200),
  constraint workspace_audit_events_target_name_length check (target_name is null or char_length(target_name) <= 200),
  constraint workspace_audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index workspace_audit_events_workspace_created_idx
  on public.workspace_audit_events (workspace_id, created_at desc, id desc);
create index workspace_audit_events_workspace_action_created_idx
  on public.workspace_audit_events (workspace_id, action, created_at desc);
create index workspace_audit_events_workspace_target_created_idx
  on public.workspace_audit_events (workspace_id, target_type, target_id, created_at desc);

create or replace function public.reject_workspace_audit_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'workspace audit events are append-only';
end;
$$;

create trigger workspace_audit_events_append_only
before update or delete on public.workspace_audit_events
for each row execute function public.reject_workspace_audit_event_mutation();

alter table public.workspace_audit_events enable row level security;
revoke all on public.workspace_audit_events from public, anon, authenticated;
grant select, insert on public.workspace_audit_events to service_role;
revoke all on function public.reject_workspace_audit_event_mutation() from public, anon, authenticated;

comment on table public.workspace_audit_events is
  'Append-only, sanitized workspace control-plane history. Secrets, credential hashes, full scopes, authorization headers, and request bodies must never be stored here.';
