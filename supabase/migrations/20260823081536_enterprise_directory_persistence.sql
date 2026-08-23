-- Explicit workspace directory overrides, effective state history, immutable request attribution, and audit events.

create table public.workspace_member_overrides (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_role text,
  department_override_enabled boolean not null default false,
  department_id uuid,
  department_position text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id,user_id),
  foreign key (department_id,workspace_id) references public.workspace_departments(id,workspace_id) on delete restrict,
  check (access_role is null or access_role in ('member','admin')),
  check (department_position is null or department_position in ('member','lead')),
  check (department_override_enabled or department_id is null)
);

create table public.workspace_member_effective_entitlements (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_role text not null,
  department_id uuid,
  department_position text,
  access_source text not null,
  department_source text not null,
  computed_at timestamptz not null default now(),
  primary key (workspace_id,user_id),
  foreign key (department_id,workspace_id) references public.workspace_departments(id,workspace_id) on delete restrict,
  check (access_role in ('member','admin','owner')),
  check (department_position is null or department_position in ('member','lead')),
  check (access_source in ('owner','manual_override','workspace','scim')),
  check (department_source in ('manual_override','manual','scim','none'))
);

create table public.workspace_member_entitlement_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_role text not null,
  department_id uuid,
  department_name text,
  department_color text,
  department_icon text,
  department_position text,
  access_source text not null,
  department_source text not null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  changed_by uuid references auth.users(id) on delete set null,
  change_reason text not null default 'reconcile',
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);
create unique index workspace_member_entitlement_history_current_idx
  on public.workspace_member_entitlement_history(workspace_id,user_id) where effective_to is null;
create index workspace_member_entitlement_history_period_idx
  on public.workspace_member_entitlement_history(workspace_id,effective_from,effective_to);

create table public.workspace_directory_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  outcome text not null default 'success',
  before_state jsonb,
  after_state jsonb,
  reason text,
  request_id text,
  created_at timestamptz not null default now(),
  check (outcome in ('success','failure','denied')),
  check (jsonb_typeof(coalesce(before_state,'{}'::jsonb))='object'),
  check (jsonb_typeof(coalesce(after_state,'{}'::jsonb))='object')
);
create index workspace_directory_audit_events_workspace_created_idx
  on public.workspace_directory_audit_events(workspace_id,created_at desc);

alter table public.gateway_requests
  add column if not exists attributed_user_id uuid,
  add column if not exists attributed_access_role text,
  add column if not exists attributed_department_id uuid,
  add column if not exists attributed_department_name text,
  add column if not exists attributed_department_color text,
  add column if not exists attribution_basis text;

create or replace function public.refresh_workspace_effective_entitlements(
  p_workspace_id uuid,
  p_changed_by uuid default null,
  p_reason text default 'reconcile'
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  candidate record;
  previous record;
begin
  for candidate in
    select wm.workspace_id,wm.user_id,
      case when w.owner_user_id=wm.user_id then 'owner'
           when o.access_role is not null then o.access_role
           else lower(wm.role::text) end as access_role,
      case when o.department_override_enabled then o.department_id else dg.department_id end as department_id,
      case when o.department_override_enabled then o.department_position else dg.position end as department_position,
      case when w.owner_user_id=wm.user_id then 'owner'
           when o.access_role is not null then 'manual_override'
           when exists(select 1 from public.workspace_access_grants ag where ag.workspace_id=wm.workspace_id and ag.user_id=wm.user_id and ag.source_type='scim_group') then 'scim'
           else 'workspace' end as access_source,
      case when o.department_override_enabled then 'manual_override'
           when dg.department_id is null then 'none'
           else dg.source_type end as department_source
    from public.workspace_members wm
    join public.workspaces w on w.id=wm.workspace_id
    left join public.workspace_member_overrides o on o.workspace_id=wm.workspace_id and o.user_id=wm.user_id
    left join lateral (
      select g.department_id,g.position,g.source_type
      from public.workspace_department_grants g
      where g.workspace_id=wm.workspace_id and g.user_id=wm.user_id
      order by g.is_primary desc,(g.source_type='manual') desc,g.created_at asc
      limit 1
    ) dg on true
    where wm.workspace_id=p_workspace_id
  loop
    select * into previous from public.workspace_member_effective_entitlements
      where workspace_id=candidate.workspace_id and user_id=candidate.user_id;

    if previous is null
       or previous.access_role is distinct from candidate.access_role
       or previous.department_id is distinct from candidate.department_id
       or previous.department_position is distinct from candidate.department_position
       or previous.access_source is distinct from candidate.access_source
       or previous.department_source is distinct from candidate.department_source then
      update public.workspace_member_entitlement_history
        set effective_to=now()
        where workspace_id=candidate.workspace_id and user_id=candidate.user_id and effective_to is null;

      insert into public.workspace_member_entitlement_history(
        workspace_id,user_id,access_role,department_id,department_name,department_color,department_icon,
        department_position,access_source,department_source,changed_by,change_reason
      )
      select candidate.workspace_id,candidate.user_id,candidate.access_role,candidate.department_id,
        d.name,d.color,d.icon,candidate.department_position,candidate.access_source,candidate.department_source,
        p_changed_by,left(coalesce(p_reason,'reconcile'),200)
      from (select 1) seed left join public.workspace_departments d on d.id=candidate.department_id;
    end if;

    insert into public.workspace_member_effective_entitlements(
      workspace_id,user_id,access_role,department_id,department_position,access_source,department_source,computed_at
    ) values (
      candidate.workspace_id,candidate.user_id,candidate.access_role,candidate.department_id,
      candidate.department_position,candidate.access_source,candidate.department_source,now()
    ) on conflict(workspace_id,user_id) do update set
      access_role=excluded.access_role,department_id=excluded.department_id,
      department_position=excluded.department_position,access_source=excluded.access_source,
      department_source=excluded.department_source,computed_at=excluded.computed_at;
  end loop;

  update public.workspace_member_entitlement_history h set effective_to=now()
  where h.workspace_id=p_workspace_id and h.effective_to is null
    and not exists(select 1 from public.workspace_members wm where wm.workspace_id=h.workspace_id and wm.user_id=h.user_id);
  delete from public.workspace_member_effective_entitlements e
  where e.workspace_id=p_workspace_id
    and not exists(select 1 from public.workspace_members wm where wm.workspace_id=e.workspace_id and wm.user_id=e.user_id);
end;
$$;

create or replace function public.apply_workspace_member_override(
  p_workspace_id uuid,p_user_id uuid,p_access_role text,
  p_department_override_enabled boolean,p_department_id uuid,p_department_position text,
  p_actor_user_id uuid,p_request_id text default null
) returns void
language plpgsql security definer set search_path=''
as $$
declare before_row jsonb; after_row jsonb; owner_id uuid;
begin
  select owner_user_id into owner_id from public.workspaces where id=p_workspace_id;
  if owner_id is null then raise exception 'Workspace not found'; end if;
  if not exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=p_user_id) then
    raise exception 'Workspace member not found';
  end if;
  if p_user_id=owner_id and (p_access_role is not null or p_department_override_enabled) then
    raise exception 'Workspace owner cannot be overridden';
  end if;
  if p_access_role is not null and p_access_role not in ('member','admin') then raise exception 'Invalid access role'; end if;
  if p_department_override_enabled and p_department_id is not null
     and not exists(select 1 from public.workspace_departments where id=p_department_id and workspace_id=p_workspace_id) then
    raise exception 'Department not found';
  end if;
  select to_jsonb(o) into before_row from public.workspace_member_overrides o where workspace_id=p_workspace_id and user_id=p_user_id;

  if p_access_role is null and not p_department_override_enabled then
    delete from public.workspace_member_overrides where workspace_id=p_workspace_id and user_id=p_user_id;
  else
    insert into public.workspace_member_overrides(workspace_id,user_id,access_role,department_override_enabled,department_id,department_position,updated_by)
    values(p_workspace_id,p_user_id,p_access_role,coalesce(p_department_override_enabled,false),
      case when p_department_override_enabled then p_department_id else null end,
      case when p_department_override_enabled then coalesce(p_department_position,'member') else null end,p_actor_user_id)
    on conflict(workspace_id,user_id) do update set access_role=excluded.access_role,
      department_override_enabled=excluded.department_override_enabled,department_id=excluded.department_id,
      department_position=excluded.department_position,updated_by=excluded.updated_by,updated_at=now();
  end if;

  perform public.reconcile_scim_entitlements(p_workspace_id);
	perform set_config('phaseo.entitlement_reconcile','on',true);
	update public.workspace_members wm set role=o.access_role::public.workspace_role
	from public.workspace_member_overrides o
	where wm.workspace_id=p_workspace_id and wm.workspace_id=o.workspace_id and wm.user_id=o.user_id and o.access_role is not null
	  and lower(wm.role::text) is distinct from o.access_role;
  perform public.refresh_workspace_effective_entitlements(p_workspace_id,p_actor_user_id,'manual_override');
  select to_jsonb(o) into after_row from public.workspace_member_overrides o where workspace_id=p_workspace_id and user_id=p_user_id;
  insert into public.workspace_directory_audit_events(workspace_id,actor_user_id,action,target_type,target_id,before_state,after_state,request_id)
  values(p_workspace_id,p_actor_user_id,'workspace.member.override','workspace_member',p_user_id::text,before_row,after_row,p_request_id);
end;
$$;

create or replace function public.refresh_effective_entitlements_after_directory_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare target_workspace_id uuid;
begin
  if current_setting('phaseo.scim_group_replace',true)='on' then return coalesce(new,old); end if;
  target_workspace_id := coalesce(new.workspace_id,old.workspace_id);
  perform set_config('phaseo.entitlement_reconcile','on',true);
  update public.workspace_members wm set role=o.access_role::public.workspace_role
  from public.workspace_member_overrides o
  where wm.workspace_id=target_workspace_id and wm.workspace_id=o.workspace_id and wm.user_id=o.user_id and o.access_role is not null
    and lower(wm.role::text) is distinct from o.access_role;
  perform public.refresh_workspace_effective_entitlements(target_workspace_id,null,'directory_sync');
  return coalesce(new,old);
end;
$$;

-- Bulk group replacement suppresses row-level reconciliation while the group is
-- incomplete, then records one effective-state transition after the final set.
create or replace function public.replace_scim_group_members(p_workspace_id uuid,p_group_id uuid,p_user_ids uuid[])
returns void language plpgsql set search_path=''
as $$
begin
  if not exists(select 1 from public.scim_groups where id=p_group_id and workspace_id=p_workspace_id) then raise exception 'SCIM group not found' using errcode='P0002'; end if;
  if exists(select 1 from unnest(coalesce(p_user_ids,'{}'::uuid[])) candidate(user_id) where not exists(select 1 from public.scim_users where id=candidate.user_id and workspace_id=p_workspace_id)) then raise exception 'SCIM user not found in workspace' using errcode='23503'; end if;
  perform set_config('phaseo.scim_group_replace','on',true);
  delete from public.scim_group_members where workspace_id=p_workspace_id and group_id=p_group_id;
  insert into public.scim_group_members(workspace_id,group_id,user_id) select p_workspace_id,p_group_id,user_id from (select distinct unnest(coalesce(p_user_ids,'{}'::uuid[])) user_id) users;
  update public.scim_groups set updated_at=now() where id=p_group_id and workspace_id=p_workspace_id;
  perform public.reconcile_scim_entitlements(p_workspace_id);
  perform set_config('phaseo.scim_group_replace','off',true);
  perform public.refresh_workspace_effective_entitlements(p_workspace_id,null,'scim_group_replace');
end;
$$;

create or replace function public.replace_scim_group(p_workspace_id uuid,p_group_id uuid,p_external_id text,p_display_name text,p_user_ids uuid[])
returns public.scim_groups language plpgsql set search_path=''
as $$
declare replaced public.scim_groups;
begin
  if not exists(select 1 from public.scim_groups where id=p_group_id and workspace_id=p_workspace_id) then raise exception 'SCIM group not found' using errcode='P0002'; end if;
  if exists(select 1 from unnest(coalesce(p_user_ids,'{}'::uuid[])) candidate(user_id) where not exists(select 1 from public.scim_users where id=candidate.user_id and workspace_id=p_workspace_id)) then raise exception 'SCIM user not found in workspace' using errcode='23503'; end if;
  perform set_config('phaseo.scim_group_replace','on',true);
  update public.scim_groups set external_id=p_external_id,display_name=p_display_name where id=p_group_id and workspace_id=p_workspace_id returning * into replaced;
  delete from public.scim_group_members where workspace_id=p_workspace_id and group_id=p_group_id;
  insert into public.scim_group_members(workspace_id,group_id,user_id) select p_workspace_id,p_group_id,user_id from (select distinct unnest(coalesce(p_user_ids,'{}'::uuid[])) user_id) users;
  perform public.reconcile_scim_entitlements(p_workspace_id);
  perform set_config('phaseo.scim_group_replace','off',true);
  perform public.refresh_workspace_effective_entitlements(p_workspace_id,null,'scim_group_replace');
  return replaced;
end;
$$;

create trigger zz_scim_group_members_refresh_effective after insert or delete on public.scim_group_members
for each row execute function public.refresh_effective_entitlements_after_directory_change();
create trigger zz_scim_group_mappings_refresh_effective after insert or update or delete on public.scim_group_mappings
for each row execute function public.refresh_effective_entitlements_after_directory_change();
create trigger zz_scim_users_refresh_effective after insert or update of active,auth_user_id,department on public.scim_users
for each row execute function public.refresh_effective_entitlements_after_directory_change();
create trigger zz_workspace_members_refresh_effective after insert or update of role or delete on public.workspace_members
for each row execute function public.refresh_effective_entitlements_after_directory_change();

create or replace function public.create_workspace_department(
  p_workspace_id uuid,p_name text,p_icon text,p_color text,p_actor_user_id uuid,p_request_id text default null
) returns public.workspace_departments
language plpgsql security definer set search_path=''
as $$
declare created public.workspace_departments;
begin
  insert into public.workspace_departments(workspace_id,name,icon,color,source_type)
  values(p_workspace_id,btrim(p_name),p_icon,p_color,'manual') returning * into created;
  insert into public.workspace_directory_audit_events(workspace_id,actor_user_id,action,target_type,target_id,after_state,request_id)
  values(p_workspace_id,p_actor_user_id,'workspace.department.create','workspace_department',created.id::text,to_jsonb(created),p_request_id);
  return created;
end;
$$;

create or replace function public.update_workspace_department(
  p_workspace_id uuid,p_department_id uuid,p_name text,p_icon text,p_color text,p_actor_user_id uuid,p_request_id text default null
) returns public.workspace_departments
language plpgsql security definer set search_path=''
as $$
declare before_row public.workspace_departments; updated public.workspace_departments;
begin
  select * into before_row from public.workspace_departments where id=p_department_id and workspace_id=p_workspace_id for update;
  if before_row is null then raise exception 'Department not found'; end if;
  update public.workspace_departments set name=btrim(p_name),icon=p_icon,color=p_color,
    name_overridden=case when source_type='scim_group' and btrim(p_name) is distinct from directory_name then true else name_overridden end,
    updated_at=now()
  where id=p_department_id and workspace_id=p_workspace_id returning * into updated;
  perform public.refresh_workspace_effective_entitlements(p_workspace_id,p_actor_user_id,'department_updated');
  insert into public.workspace_directory_audit_events(workspace_id,actor_user_id,action,target_type,target_id,before_state,after_state,request_id)
  values(p_workspace_id,p_actor_user_id,'workspace.department.update','workspace_department',p_department_id::text,to_jsonb(before_row),to_jsonb(updated),p_request_id);
  return updated;
end;
$$;

create or replace function public.snapshot_gateway_request_entitlement()
returns trigger language plpgsql security definer set search_path=''
as $$
declare entitlement record; identity_user_id uuid;
begin
  identity_user_id := new.oauth_user_id;
  if identity_user_id is null and new.key_id is not null then
    select oauth_user_id into identity_user_id from public.keys where id=new.key_id;
  end if;
  if identity_user_id is null then return new; end if;
  select e.*,d.name,d.color into entitlement
    from public.workspace_member_effective_entitlements e
    left join public.workspace_departments d on d.id=e.department_id
    where e.workspace_id=new.workspace_id and e.user_id=identity_user_id;
  if entitlement is not null then
    new.attributed_user_id=identity_user_id;
    new.attributed_access_role=entitlement.access_role;
    new.attributed_department_id=entitlement.department_id;
    new.attributed_department_name=entitlement.name;
    new.attributed_department_color=entitlement.color;
    new.attribution_basis=case when new.oauth_user_id is not null then 'oauth_user' else 'oauth_key_user' end;
  end if;
  return new;
end;
$$;
drop trigger if exists gateway_requests_snapshot_entitlement on public.gateway_requests;
create trigger gateway_requests_snapshot_entitlement before insert on public.gateway_requests
for each row execute function public.snapshot_gateway_request_entitlement();

alter table public.workspace_member_overrides enable row level security;
alter table public.workspace_member_effective_entitlements enable row level security;
alter table public.workspace_member_entitlement_history enable row level security;
alter table public.workspace_directory_audit_events enable row level security;
revoke all on public.workspace_member_overrides,public.workspace_member_effective_entitlements,
  public.workspace_member_entitlement_history,public.workspace_directory_audit_events from anon,authenticated;
grant select,insert,update,delete on public.workspace_member_overrides to service_role;
grant select,insert,update,delete on public.workspace_member_effective_entitlements to service_role;
grant select,insert,update on public.workspace_member_entitlement_history to service_role;
grant select,insert on public.workspace_directory_audit_events to service_role;
revoke all on function public.refresh_workspace_effective_entitlements(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.apply_workspace_member_override(uuid,uuid,text,boolean,uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.create_workspace_department(uuid,text,text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.update_workspace_department(uuid,uuid,text,text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.refresh_effective_entitlements_after_directory_change() from public,anon,authenticated;
grant execute on function public.refresh_workspace_effective_entitlements(uuid,uuid,text) to service_role;
grant execute on function public.apply_workspace_member_override(uuid,uuid,text,boolean,uuid,text,uuid,text) to service_role;
grant execute on function public.create_workspace_department(uuid,text,text,text,uuid,text) to service_role;
grant execute on function public.update_workspace_department(uuid,uuid,text,text,text,uuid,text) to service_role;
grant execute on function public.refresh_effective_entitlements_after_directory_change() to service_role;

select public.refresh_workspace_effective_entitlements(id,null,'migration_backfill') from public.workspaces;
