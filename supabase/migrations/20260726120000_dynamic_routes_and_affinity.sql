-- User-authored dynamic routing policies attached to inference keys.
-- Route configuration is deliberately bounded JSON so the data plane can cache
-- and evaluate it without storing request content or executable expressions.

alter table public.workspace_settings
  add column if not exists cache_aware_routing_enabled boolean default true;
update public.workspace_settings
set cache_aware_routing_enabled = true
where cache_aware_routing_enabled is null;
alter table public.workspace_settings
  alter column cache_aware_routing_enabled set default true,
  alter column cache_aware_routing_enabled set not null;

create table if not exists public.gateway_dynamic_routes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
	  slug text not null,
  description text,
  status text not null default 'active',
  version integer not null default 1,
	  deployed_version integer,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gateway_dynamic_routes_name_check check (
    char_length(trim(name)) between 1 and 80
  ),
	  constraint gateway_dynamic_routes_slug_check check (
	    slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'
	  ),
  constraint gateway_dynamic_routes_description_check check (
    description is null or char_length(description) <= 500
  ),
  constraint gateway_dynamic_routes_status_check check (
    status in ('active', 'paused')
  ),
  constraint gateway_dynamic_routes_version_check check (version > 0),
  constraint gateway_dynamic_routes_config_check check (
    jsonb_typeof(config) = 'object' and pg_column_size(config) <= 65536
  ),
	  constraint gateway_dynamic_routes_workspace_name_key unique (workspace_id, name),
	  constraint gateway_dynamic_routes_workspace_slug_key unique (workspace_id, slug)
);

create table if not exists public.gateway_dynamic_route_versions (
	  id uuid primary key default gen_random_uuid(),
	  route_id uuid not null references public.gateway_dynamic_routes(id) on delete cascade,
	  version integer not null,
	  config jsonb not null,
	  created_by uuid references auth.users(id) on delete set null,
	  created_at timestamptz not null default now(),
	  constraint gateway_dynamic_route_versions_version_check check (version > 0),
	  constraint gateway_dynamic_route_versions_config_check check (
	    jsonb_typeof(config) = 'object' and pg_column_size(config) <= 65536
	  ),
	  constraint gateway_dynamic_route_versions_route_version_key unique (route_id, version)
);

create table if not exists public.gateway_dynamic_route_keys (
  route_id uuid not null references public.gateway_dynamic_routes(id) on delete cascade,
  key_id uuid not null references public.keys(id) on delete cascade,
  attached_by uuid references auth.users(id) on delete set null,
  attached_at timestamptz not null default now(),
  primary key (route_id, key_id),
  constraint gateway_dynamic_route_keys_one_route_per_key unique (key_id)
);

create index if not exists gateway_dynamic_routes_workspace_idx
  on public.gateway_dynamic_routes (workspace_id, updated_at desc);
create index if not exists gateway_dynamic_route_keys_route_idx
  on public.gateway_dynamic_route_keys (route_id, key_id);
create index if not exists gateway_dynamic_route_versions_route_idx
	  on public.gateway_dynamic_route_versions (route_id, version desc);

alter table public.gateway_dynamic_routes enable row level security;
alter table public.gateway_dynamic_route_versions enable row level security;
alter table public.gateway_dynamic_route_keys enable row level security;

drop policy if exists gateway_dynamic_routes_workspace_select
  on public.gateway_dynamic_routes;
create policy gateway_dynamic_routes_workspace_select
  on public.gateway_dynamic_routes for select to authenticated
  using ((select public.is_workspace_member(workspace_id)));

drop policy if exists gateway_dynamic_routes_workspace_write
  on public.gateway_dynamic_routes;
create policy gateway_dynamic_routes_workspace_write
  on public.gateway_dynamic_routes for all to authenticated
  using ((select public.is_workspace_admin(workspace_id)))
  with check ((select public.is_workspace_admin(workspace_id)));

drop policy if exists gateway_dynamic_route_versions_workspace_select
	  on public.gateway_dynamic_route_versions;
create policy gateway_dynamic_route_versions_workspace_select
	  on public.gateway_dynamic_route_versions for select to authenticated
	  using (exists (
	    select 1 from public.gateway_dynamic_routes route
	    where route.id = gateway_dynamic_route_versions.route_id
	      and (select public.is_workspace_member(route.workspace_id))
	  ));

drop policy if exists gateway_dynamic_route_versions_workspace_write
	  on public.gateway_dynamic_route_versions;
create policy gateway_dynamic_route_versions_workspace_write
	  on public.gateway_dynamic_route_versions for all to authenticated
	  using (exists (
	    select 1 from public.gateway_dynamic_routes route
	    where route.id = gateway_dynamic_route_versions.route_id
	      and (select public.is_workspace_admin(route.workspace_id))
	  ))
	  with check (exists (
	    select 1 from public.gateway_dynamic_routes route
	    where route.id = gateway_dynamic_route_versions.route_id
	      and (select public.is_workspace_admin(route.workspace_id))
	  ));

drop policy if exists gateway_dynamic_route_keys_workspace_select
  on public.gateway_dynamic_route_keys;
create policy gateway_dynamic_route_keys_workspace_select
  on public.gateway_dynamic_route_keys for select to authenticated
  using (exists (
    select 1 from public.gateway_dynamic_routes route
    where route.id = gateway_dynamic_route_keys.route_id
      and (select public.is_workspace_member(route.workspace_id))
  ));

drop policy if exists gateway_dynamic_route_keys_workspace_write
  on public.gateway_dynamic_route_keys;
create policy gateway_dynamic_route_keys_workspace_write
  on public.gateway_dynamic_route_keys for all to authenticated
  using (exists (
    select 1 from public.gateway_dynamic_routes route
    where route.id = gateway_dynamic_route_keys.route_id
      and (select public.is_workspace_admin(route.workspace_id))
  ))
  with check (exists (
    select 1 from public.gateway_dynamic_routes route
    join public.keys gateway_key on gateway_key.id = gateway_dynamic_route_keys.key_id
    where route.id = gateway_dynamic_route_keys.route_id
      and gateway_key.workspace_id = route.workspace_id
      and (select public.is_workspace_admin(route.workspace_id))
  ));

grant select, insert, update, delete on public.gateway_dynamic_routes to authenticated;
grant select, insert, update, delete on public.gateway_dynamic_route_versions to authenticated;
grant select, insert, update, delete on public.gateway_dynamic_route_keys to authenticated;
grant select, insert, update, delete on public.gateway_dynamic_routes to service_role;
grant select, insert, update, delete on public.gateway_dynamic_route_versions to service_role;
grant select, insert, update, delete on public.gateway_dynamic_route_keys to service_role;

comment on table public.gateway_dynamic_routes is
	  'Dynamic routing identities and their currently deployed immutable configuration snapshots.';
comment on table public.gateway_dynamic_route_versions is
	  'Immutable dynamic route drafts and deployment history.';
comment on table public.gateway_dynamic_route_keys is
  'Attaches at most one active dynamic route to each inference API key.';
