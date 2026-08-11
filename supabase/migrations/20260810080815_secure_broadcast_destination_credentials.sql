alter table public.workspace_broadcast_destinations
  add column if not exists destination_config_ciphertext text,
  add column if not exists destination_config_iv text,
  add column if not exists destination_config_key_version text;

comment on column public.workspace_broadcast_destinations.destination_config is
  'Legacy non-secret configuration only. New destination credentials are stored in encrypted columns.';
comment on column public.workspace_broadcast_destinations.destination_config_ciphertext is
  'AES-GCM encrypted destination configuration. Never return through browser-facing APIs.';

drop policy if exists team_broadcast_destinations_select_own_team on public.workspace_broadcast_destinations;
drop policy if exists workspace_broadcast_destinations_select_own_workspace on public.workspace_broadcast_destinations;
create policy workspace_broadcast_destinations_select_own_workspace
  on public.workspace_broadcast_destinations
  for select
  to authenticated
  using (public.is_workspace_admin(workspace_id));

revoke all on public.workspace_broadcast_destinations from anon;
grant select, insert, update, delete on public.workspace_broadcast_destinations to authenticated;
grant all on public.workspace_broadcast_destinations to service_role;
