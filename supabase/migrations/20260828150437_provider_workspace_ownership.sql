-- Workspace personas are structural, while tier/billing remain commercial.
alter table public.workspaces
  add column if not exists workspace_kind text not null default 'personal';

update public.workspaces
set workspace_kind = case
  when lower(coalesce(tier, '')) = 'enterprise' then 'enterprise'
  when lower(coalesce(name, '')) = 'personal' then 'personal'
  else 'organization'
end
where workspace_kind = 'personal';

alter table public.workspaces
  drop constraint if exists workspaces_workspace_kind_check,
  add constraint workspaces_workspace_kind_check
    check (workspace_kind in ('personal', 'organization', 'enterprise', 'provider'));

create index if not exists workspaces_kind_idx on public.workspaces (workspace_kind, id);

comment on column public.workspaces.workspace_kind is
  'Structural workspace persona. Commercial access remains defined by tier, billing mode, and entitlements.';
