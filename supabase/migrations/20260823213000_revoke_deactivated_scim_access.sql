-- Reconcile SCIM-derived grants when a directory user is deactivated. Manual
-- grants are deliberately preserved because their provenance cannot be
-- distinguished safely from the initial workspace-membership backfill.
create or replace function public.sync_scim_user_workspace_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.reconcile_scim_entitlements(new.workspace_id);
  return new;
end;
$$;

revoke all on function public.sync_scim_user_workspace_access() from public, anon, authenticated;
grant execute on function public.sync_scim_user_workspace_access() to service_role;
