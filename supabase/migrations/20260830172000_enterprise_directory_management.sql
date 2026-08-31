-- Transactional helpers for management API directory mutations.
-- phaseo:allow-destructive-migration reason: department deletion is an explicit management API action that atomically removes dependent grants and audit-tracks the change

create or replace function public.management_create_workspace_department(
  p_workspace_id uuid, p_name text, p_description text, p_icon text, p_color text,
  p_actor_user_id uuid, p_request_id text default null
) returns public.workspace_departments
language plpgsql security definer set search_path=''
as $$
declare created public.workspace_departments;
begin
  insert into public.workspace_departments(workspace_id,name,description,icon,color,source_type)
  values(p_workspace_id,btrim(p_name),p_description,p_icon,p_color,'manual') returning * into created;
  insert into public.workspace_directory_audit_events(workspace_id,actor_user_id,action,target_type,target_id,after_state,request_id)
  values(p_workspace_id,p_actor_user_id,'workspace.department.create','workspace_department',created.id::text,to_jsonb(created),p_request_id);
  return created;
end;
$$;

create or replace function public.management_update_workspace_department(
  p_workspace_id uuid, p_department_id uuid, p_name text, p_description text,
  p_icon text, p_color text, p_actor_user_id uuid, p_request_id text default null
) returns public.workspace_departments
language plpgsql security definer set search_path=''
as $$
declare before_row public.workspace_departments; updated public.workspace_departments;
begin
  select * into before_row from public.workspace_departments
  where id=p_department_id and workspace_id=p_workspace_id for update;
  if before_row is null then raise exception 'Department not found'; end if;
  update public.workspace_departments set
    name=btrim(p_name), description=p_description, icon=p_icon, color=p_color,
    name_overridden=case when source_type='scim_group' and btrim(p_name) is distinct from directory_name then true else name_overridden end,
    updated_at=now()
  where id=p_department_id and workspace_id=p_workspace_id returning * into updated;
  perform public.refresh_workspace_effective_entitlements(p_workspace_id,p_actor_user_id,'department_updated');
  insert into public.workspace_directory_audit_events(workspace_id,actor_user_id,action,target_type,target_id,before_state,after_state,request_id)
  values(p_workspace_id,p_actor_user_id,'workspace.department.update','workspace_department',p_department_id::text,to_jsonb(before_row),to_jsonb(updated),p_request_id);
  return updated;
end;
$$;

create or replace function public.management_delete_workspace_department(
  p_workspace_id uuid, p_department_id uuid, p_actor_user_id uuid, p_request_id text default null
) returns public.workspace_departments
language plpgsql security definer set search_path=''
as $$
declare deleted public.workspace_departments;
begin
  select * into deleted from public.workspace_departments
  where id=p_department_id and workspace_id=p_workspace_id and source_type='manual' for update;
  if deleted is null then raise exception 'Department not found'; end if;
  delete from public.workspace_department_grants where workspace_id=p_workspace_id and department_id=p_department_id;
  update public.workspace_member_overrides set
    department_override_enabled=false, department_id=null, department_position=null, updated_at=now()
  where workspace_id=p_workspace_id and department_id=p_department_id;
  perform public.refresh_workspace_effective_entitlements(p_workspace_id,p_actor_user_id,'department_deleted');
  delete from public.workspace_departments where id=p_department_id and workspace_id=p_workspace_id returning * into deleted;
  insert into public.workspace_directory_audit_events(workspace_id,actor_user_id,action,target_type,target_id,before_state,request_id)
  values(p_workspace_id,p_actor_user_id,'workspace.department.delete','workspace_department',p_department_id::text,to_jsonb(deleted),p_request_id);
  return deleted;
end;
$$;

create or replace function public.management_set_workspace_department_member(
  p_workspace_id uuid, p_department_id uuid, p_user_id uuid, p_position text,
  p_primary boolean, p_actor_user_id uuid, p_request_id text default null
) returns public.workspace_department_grants
language plpgsql security definer set search_path=''
as $$
declare saved public.workspace_department_grants;
begin
  if not exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=p_user_id) then
    raise exception 'Workspace member not found';
  end if;
  if not exists(select 1 from public.workspace_departments where workspace_id=p_workspace_id and id=p_department_id) then
    raise exception 'Department not found';
  end if;
  if p_position not in ('member','lead') then raise exception 'Invalid department position'; end if;
  if p_primary then
    update public.workspace_department_grants set is_primary=false,updated_at=now()
    where workspace_id=p_workspace_id and user_id=p_user_id and source_type='manual';
  end if;
  insert into public.workspace_department_grants(
    workspace_id,user_id,department_id,source_type,source_id,position,is_primary,updated_at
  ) values (
    p_workspace_id,p_user_id,p_department_id,'manual',p_user_id,p_position,coalesce(p_primary,false),now()
  ) on conflict(workspace_id,user_id,department_id,source_type,source_id) do update set
    position=excluded.position,is_primary=excluded.is_primary,updated_at=excluded.updated_at
  returning * into saved;
  perform public.refresh_workspace_effective_entitlements(p_workspace_id,p_actor_user_id,'department_membership_updated');
  return saved;
end;
$$;

create or replace function public.management_delete_workspace_department_member(
  p_workspace_id uuid, p_department_id uuid, p_user_id uuid, p_actor_user_id uuid
) returns boolean
language plpgsql security definer set search_path=''
as $$
begin
  delete from public.workspace_department_grants
  where workspace_id=p_workspace_id and department_id=p_department_id and user_id=p_user_id and source_type='manual';
  if not found then return false; end if;
  perform public.refresh_workspace_effective_entitlements(p_workspace_id,p_actor_user_id,'department_membership_deleted');
  return true;
end;
$$;

revoke all on function public.management_create_workspace_department(uuid,text,text,text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.management_update_workspace_department(uuid,uuid,text,text,text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.management_delete_workspace_department(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.management_set_workspace_department_member(uuid,uuid,uuid,text,boolean,uuid,text) from public,anon,authenticated;
revoke all on function public.management_delete_workspace_department_member(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.management_create_workspace_department(uuid,text,text,text,text,uuid,text) to service_role;
grant execute on function public.management_update_workspace_department(uuid,uuid,text,text,text,text,uuid,text) to service_role;
grant execute on function public.management_delete_workspace_department(uuid,uuid,uuid,text) to service_role;
grant execute on function public.management_set_workspace_department_member(uuid,uuid,uuid,text,boolean,uuid,text) to service_role;
grant execute on function public.management_delete_workspace_department_member(uuid,uuid,uuid,uuid) to service_role;
