-- phaseo:allow-destructive-migration reason: deactivated SCIM users must lose legacy member grants that were incorrectly backfilled as manual access.
-- Remove legacy membership grants that were backfilled as "manual" after the
-- original SCIM linker had already provisioned the workspace membership.
create or replace function public.sync_scim_user_workspace_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.auth_user_id is not null and not new.active then
    delete from public.workspace_access_grants
    where workspace_id = new.workspace_id
      and user_id = new.auth_user_id
      and source_type = 'manual'
      and source_id = new.auth_user_id
      and access_role = 'member';
  end if;
  perform public.reconcile_scim_entitlements(new.workspace_id);
  return new;
end;
$$;

revoke all on function public.sync_scim_user_workspace_access() from public, anon, authenticated;
grant execute on function public.sync_scim_user_workspace_access() to service_role;
