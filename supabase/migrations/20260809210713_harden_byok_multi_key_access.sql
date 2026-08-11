-- Keep BYOK secrets readable by workspace members while restricting every
-- mutation path to workspace owners/admins. PostgreSQL combines permissive
-- policies with OR, so the legacy ALL policy must be removed rather than
-- layered beneath the narrower admin policies.
alter table public.byok_keys enable row level security;

drop policy if exists "BYOK: team members can modify" on public.byok_keys;
drop policy if exists "BYOK: team members can select" on public.byok_keys;
drop policy if exists byok_keys_select_own_team on public.byok_keys;
drop policy if exists byok_keys_insert_own_team on public.byok_keys;
drop policy if exists byok_keys_update_own_team on public.byok_keys;
drop policy if exists byok_keys_delete_own_team on public.byok_keys;

create policy byok_keys_select_workspace_member
  on public.byok_keys
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy byok_keys_insert_workspace_admin
  on public.byok_keys
  for insert
  to authenticated
  with check (public.is_workspace_admin(workspace_id));

create policy byok_keys_update_workspace_admin
  on public.byok_keys
  for update
  to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create policy byok_keys_delete_workspace_admin
  on public.byok_keys
  for delete
  to authenticated
  using (public.is_workspace_admin(workspace_id));
