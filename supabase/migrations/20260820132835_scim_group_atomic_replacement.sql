-- phaseo:allow-destructive-migration reason: SCIM group replacement requires transactionally replacing its scoped membership rows.

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
  update public.scim_groups set updated_at = now() where id = p_group_id and workspace_id = p_workspace_id;
end;
$$;

create or replace function public.replace_scim_group(
  p_workspace_id uuid,
  p_group_id uuid,
  p_external_id text,
  p_display_name text,
  p_user_ids uuid[]
)
returns public.scim_groups
language plpgsql
set search_path = ''
as $$
declare
  replaced public.scim_groups;
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
  update public.scim_groups
  set external_id = p_external_id, display_name = p_display_name
  where id = p_group_id and workspace_id = p_workspace_id
  returning * into replaced;
  delete from public.scim_group_members where workspace_id = p_workspace_id and group_id = p_group_id;
  insert into public.scim_group_members (workspace_id, group_id, user_id)
  select p_workspace_id, p_group_id, user_id
  from (select distinct unnest(coalesce(p_user_ids, '{}'::uuid[])) as user_id) users;
  return replaced;
end;
$$;

revoke all on function public.replace_scim_group(uuid, uuid, text, text, uuid[]) from public, anon, authenticated;
grant execute on function public.replace_scim_group(uuid, uuid, text, text, uuid[]) to service_role;
