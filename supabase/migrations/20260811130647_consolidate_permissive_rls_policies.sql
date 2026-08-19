-- Exact duplicate policies.
drop policy if exists "api_apps readable by team members" on public.api_apps;
drop policy if exists "Enable users to view their own data only" on public.credit_ledger;
drop policy if exists "users can read self" on public.users;
drop policy if exists "users: read self" on public.users;
drop policy if exists "users: update self" on public.users;
drop policy if exists "wallets: select if team member" on public.wallets;

-- Keep the canonical workspace-aware key policies. The removed legacy INSERT
-- policy allowed any member to create keys and bypassed the admin requirement.
drop policy if exists "Delete keys only owners/admins" on public.keys;
drop policy if exists "Only insert for teams they are part of" on public.keys;
drop policy if exists "Select keys for teams they are part of" on public.keys;
drop policy if exists "Update keys only owners/admins" on public.keys;

-- These are intentionally separate access branches, but one combined policy
-- is easier to reason about and avoids permissive-policy overlap.
drop policy if exists oauth_authorizations_select_own on public.oauth_authorizations;
drop policy if exists oauth_authorizations_select_team_apps on public.oauth_authorizations;
create policy oauth_authorizations_select_authorized
  on public.oauth_authorizations
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.oauth_app_metadata metadata
      where metadata.client_id = oauth_authorizations.client_id
        and public.is_workspace_member(metadata.workspace_id)
    )
  );

-- Canonical invite policies cover workspace admins and enforce assignable
-- roles. Legacy owner policies bypassed those role checks.
drop policy if exists "team_invites: delete by owner" on public.workspace_invites;
drop policy if exists "team_invites: insert by owner" on public.workspace_invites;
drop policy if exists "team_invites: select if owner" on public.workspace_invites;
drop policy if exists "team_invites: update by owner" on public.workspace_invites;

-- Remove broad legacy request policies, including an unrestricted authenticated
-- INSERT policy. Canonical policies enforce invite validity and state changes.
drop policy if exists "Enable insert for authenticated users only" on public.workspace_join_requests;
drop policy if exists "join_requests: select if owner" on public.workspace_join_requests;
drop policy if exists "join_requests: update by owner" on public.workspace_join_requests;

-- Consolidate member deletion so admins can remove non-owner members and users
-- can leave themselves, while the workspace owner's membership is protected.
drop policy if exists "team_members: delete by admin_or_owner" on public.workspace_members;
drop policy if exists "team_members: self leave" on public.workspace_members;
drop policy if exists team_members_delete_admin on public.workspace_members;
create policy workspace_members_delete_authorized
  on public.workspace_members
  for delete
  to authenticated
  using (
    not exists (
      select 1
      from public.workspaces workspace
      where workspace.id = workspace_members.workspace_id
        and workspace.owner_user_id = workspace_members.user_id
    )
    and (
      public.is_workspace_admin(workspace_id)
      or user_id = (select auth.uid())
    )
  );

drop policy if exists "team_members: insert by admin_or_owner" on public.workspace_members;
drop policy if exists "team_members: select if member" on public.workspace_members;
drop policy if exists "team_members: update by admin_or_owner" on public.workspace_members;

-- is_workspace_member already includes the workspace owner, so the additional
-- read policies are exact duplicates. The canonical update policy intentionally
-- supports both owners and admins.
drop policy if exists "teams: read if member or owner" on public.workspaces;
drop policy if exists teams_select_member on public.workspaces;
drop policy if exists "teams: update if owner" on public.workspaces;
