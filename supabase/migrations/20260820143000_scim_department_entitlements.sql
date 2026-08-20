-- phaseo:allow-destructive-migration reason: entitlement reconciliation removes only stale SCIM-derived grants and memberships.

create table public.workspace_departments (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, name_normalized text generated always as (lower(btrim(name))) stored,
  description text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (workspace_id, name_normalized), unique (id, workspace_id), check (length(btrim(name)) between 1 and 100)
);

create table public.scim_group_mappings (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scim_group_id uuid not null, department_id uuid not null, access_role text not null default 'member', department_position text not null default 'member',
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (scim_group_id, workspace_id) references public.scim_groups(id, workspace_id) on delete cascade,
  foreign key (department_id, workspace_id) references public.workspace_departments(id, workspace_id) on delete cascade,
  unique (scim_group_id, department_id), unique (id, workspace_id),
  check (access_role in ('member','admin')), check (department_position in ('member','lead'))
);

create table public.workspace_access_grants (
  workspace_id uuid not null references public.workspaces(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null, source_id uuid not null, access_role text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (workspace_id,user_id,source_type,source_id), check (source_type in ('manual','scim_group')), check (access_role in ('member','admin','owner'))
);

create table public.workspace_department_grants (
  workspace_id uuid not null references public.workspaces(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  department_id uuid not null, source_type text not null, source_id uuid not null, position text not null default 'member', is_primary boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (workspace_id,user_id,department_id,source_type,source_id),
  foreign key (department_id,workspace_id) references public.workspace_departments(id,workspace_id) on delete cascade,
  check (source_type in ('manual','scim_group')), check (position in ('member','lead'))
);

create index workspace_departments_workspace_idx on public.workspace_departments(workspace_id);
create index scim_group_mappings_workspace_idx on public.scim_group_mappings(workspace_id);
create index workspace_access_grants_effective_idx on public.workspace_access_grants(workspace_id,user_id,access_role);
create index workspace_department_grants_department_idx on public.workspace_department_grants(workspace_id,department_id,user_id);

insert into public.workspace_access_grants(workspace_id,user_id,source_type,source_id,access_role)
select workspace_id,user_id,'manual',user_id,lower(role::text) from public.workspace_members
where lower(role::text) in ('member','admin','owner') on conflict do nothing;

create or replace function public.reconcile_scim_entitlements(p_workspace_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
  select owner_user_id into owner_id from public.workspaces where id=p_workspace_id;
  delete from public.workspace_access_grants where workspace_id=p_workspace_id and source_type='scim_group';
  insert into public.workspace_access_grants(workspace_id,user_id,source_type,source_id,access_role)
  select distinct m.workspace_id,u.auth_user_id,'scim_group',m.id,m.access_role
  from public.scim_group_mappings m join public.scim_group_members gm on gm.group_id=m.scim_group_id and gm.workspace_id=m.workspace_id
  join public.scim_users u on u.id=gm.user_id and u.workspace_id=m.workspace_id
  where m.workspace_id=p_workspace_id and u.active and u.auth_user_id is not null;
  delete from public.workspace_department_grants where workspace_id=p_workspace_id and source_type='scim_group';
  insert into public.workspace_department_grants(workspace_id,user_id,department_id,source_type,source_id,position,is_primary)
  select distinct m.workspace_id,u.auth_user_id,m.department_id,'scim_group',m.id,m.department_position,false
  from public.scim_group_mappings m join public.scim_group_members gm on gm.group_id=m.scim_group_id and gm.workspace_id=m.workspace_id
  join public.scim_users u on u.id=gm.user_id and u.workspace_id=m.workspace_id
  where m.workspace_id=p_workspace_id and u.active and u.auth_user_id is not null;
  update public.workspace_department_grants g set is_primary=true,updated_at=now()
  from public.scim_users u,public.workspace_departments d
  where g.workspace_id=p_workspace_id and g.source_type='scim_group' and g.user_id=u.auth_user_id
    and u.workspace_id=g.workspace_id and u.active and d.id=g.department_id and d.workspace_id=g.workspace_id
    and u.department is not null and d.name_normalized=lower(btrim(u.department));
  perform set_config('phaseo.entitlement_reconcile','on',true);
  insert into public.workspace_members(workspace_id,user_id,role)
  select workspace_id,user_id,(case when bool_or(access_role='owner') then 'owner' when bool_or(access_role='admin') then 'admin' else 'member' end)::public.workspace_role
  from public.workspace_access_grants where workspace_id=p_workspace_id group by workspace_id,user_id
  on conflict(workspace_id,user_id) do update set role=excluded.role;
  delete from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id<>owner_id
    and not exists(select 1 from public.workspace_access_grants g where g.workspace_id=wm.workspace_id and g.user_id=wm.user_id);
end $$;

create or replace function public.capture_manual_workspace_grant() returns trigger language plpgsql set search_path='' as $$
begin
  if current_setting('phaseo.entitlement_reconcile',true)='on' then return coalesce(new,old); end if;
  if tg_op='DELETE' then delete from public.workspace_access_grants where workspace_id=old.workspace_id and user_id=old.user_id and source_type='manual'; return old; end if;
  insert into public.workspace_access_grants(workspace_id,user_id,source_type,source_id,access_role) values(new.workspace_id,new.user_id,'manual',new.user_id,lower(new.role::text))
  on conflict(workspace_id,user_id,source_type,source_id) do update set access_role=excluded.access_role,updated_at=now(); return new;
end $$;
create trigger workspace_members_capture_manual_grant after insert or delete or update of role on public.workspace_members for each row execute function public.capture_manual_workspace_grant();

create or replace function public.reconcile_scim_entitlements_trigger() returns trigger language plpgsql set search_path='' as $$
begin perform public.reconcile_scim_entitlements(coalesce(new.workspace_id,old.workspace_id)); return coalesce(new,old); end $$;
create trigger scim_group_mappings_reconcile after insert or update or delete on public.scim_group_mappings for each row execute function public.reconcile_scim_entitlements_trigger();
create trigger scim_group_members_reconcile after insert or delete on public.scim_group_members for each row execute function public.reconcile_scim_entitlements_trigger();

create or replace function public.sync_scim_user_workspace_access() returns trigger language plpgsql set search_path='' as $$
begin perform public.reconcile_scim_entitlements(new.workspace_id); return new; end $$;

alter table public.workspace_departments enable row level security; alter table public.scim_group_mappings enable row level security;
alter table public.workspace_access_grants enable row level security; alter table public.workspace_department_grants enable row level security;
revoke all on public.workspace_departments,public.scim_group_mappings,public.workspace_access_grants,public.workspace_department_grants from anon,authenticated;
grant select,insert,update,delete on public.workspace_departments,public.scim_group_mappings,public.workspace_access_grants,public.workspace_department_grants to service_role;
revoke all on function public.reconcile_scim_entitlements(uuid) from public,anon,authenticated; grant execute on function public.reconcile_scim_entitlements(uuid) to service_role;
