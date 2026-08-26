alter table public.workspace_departments
  add column if not exists icon text not null default 'users',
  add column if not exists color text not null default 'slate',
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_id uuid,
  add column if not exists directory_name text,
  add column if not exists name_overridden boolean not null default false;

alter table public.workspace_departments
  add constraint workspace_departments_icon_check
    check (icon in ('users','briefcase','megaphone','code','palette','headphones','landmark','scale','heart-pulse','globe','flask','graduation-cap','shield-check','shopping-bag','wrench','truck','handshake','chart')),
  add constraint workspace_departments_color_check
    check (color in ('blue','emerald','amber','rose','violet','slate','cyan','teal','lime','yellow','orange','red','pink','fuchsia','indigo','sky','green','purple')),
  add constraint workspace_departments_source_check
    check (source_type in ('manual','scim_group'));

create unique index workspace_departments_directory_source_idx
  on public.workspace_departments(workspace_id,source_type,source_id)
  where source_id is not null;

create or replace function public.provision_department_from_scim_group()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  department_row public.workspace_departments;
  selected_color text;
begin
  selected_color := case substring(md5(new.id::text),1,1)
    when '0' then 'blue' when '1' then 'cyan' when '2' then 'emerald'
    when '3' then 'amber' when '4' then 'orange' when '5' then 'rose'
    when '6' then 'violet' when '7' then 'fuchsia' else 'slate' end;

  insert into public.workspace_departments(
    workspace_id,name,icon,color,source_type,source_id,directory_name
  ) values (
    new.workspace_id,new.display_name,'users',selected_color,'scim_group',new.id,new.display_name
  )
  on conflict (workspace_id,source_type,source_id) where source_id is not null
  do update set
    directory_name=excluded.directory_name,
    name=case when public.workspace_departments.name_overridden then public.workspace_departments.name else excluded.directory_name end,
    updated_at=now()
  returning * into department_row;

  insert into public.scim_group_mappings(
    workspace_id,scim_group_id,department_id,access_role,department_position
  ) values (
    new.workspace_id,new.id,department_row.id,'member','member'
  ) on conflict (scim_group_id,department_id) do nothing;

  return new;
end;
$$;

drop trigger if exists scim_groups_provision_department on public.scim_groups;
create trigger scim_groups_provision_department
after insert or update of display_name on public.scim_groups
for each row execute function public.provision_department_from_scim_group();

insert into public.workspace_departments(workspace_id,name,icon,color,source_type,source_id,directory_name)
select g.workspace_id,g.display_name,'users',
  case substring(md5(g.id::text),1,1)
    when '0' then 'blue' when '1' then 'cyan' when '2' then 'emerald'
    when '3' then 'amber' when '4' then 'orange' when '5' then 'rose'
    when '6' then 'violet' when '7' then 'fuchsia' else 'slate' end,
  'scim_group',g.id,g.display_name
from public.scim_groups g
on conflict (workspace_id,source_type,source_id) where source_id is not null do nothing;

insert into public.scim_group_mappings(workspace_id,scim_group_id,department_id,access_role,department_position)
select g.workspace_id,g.id,d.id,'member','member'
from public.scim_groups g
join public.workspace_departments d on d.workspace_id=g.workspace_id and d.source_type='scim_group' and d.source_id=g.id
on conflict (scim_group_id,department_id) do nothing;
