-- Provider adapter control plane.
--
-- These tables are intentionally not exposed to anon or authenticated roles.
-- Runtime consumers read immutable, published execution plans with service-role
-- credentials; draft configuration remains an internal administrative surface.

create table if not exists public.v2_adapter_primitives (
  primitive_key text primary key,
  primitive_kind text not null,
  code_version integer not null default 1,
  config_schema jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_adapter_primitives_key_check check (primitive_key ~ '^[a-z0-9][a-z0-9._-]*$'),
  constraint v2_adapter_primitives_kind_check check (primitive_kind in (
    'request_mapper', 'response_parser', 'stream_parser', 'auth_signer',
    'transport', 'usage_normalizer', 'error_normalizer', 'job_handler'
  )),
  constraint v2_adapter_primitives_status_check check (status in ('active', 'deprecated', 'disabled')),
  constraint v2_adapter_primitives_schema_check check (jsonb_typeof(config_schema) = 'object')
);

create table if not exists public.v2_capability_adapters (
  capability_adapter_id uuid primary key default gen_random_uuid(),
  capability_id text not null,
  adapter_key text not null,
  adapter_version integer not null default 1,
  primitive_bindings jsonb not null,
  default_config jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_capability_adapters_key unique (adapter_key, adapter_version),
  constraint v2_capability_adapters_adapter_key_check check (adapter_key ~ '^[a-z0-9][a-z0-9._-]*$'),
  constraint v2_capability_adapters_version_check check (adapter_version > 0),
  constraint v2_capability_adapters_bindings_check check (jsonb_typeof(primitive_bindings) = 'object'),
  constraint v2_capability_adapters_config_check check (jsonb_typeof(default_config) = 'object'),
  constraint v2_capability_adapters_status_check check (status in ('draft', 'active', 'deprecated', 'disabled'))
);

create index if not exists v2_capability_adapters_lookup_idx
  on public.v2_capability_adapters (capability_id, status, adapter_key, adapter_version desc);

create table if not exists public.v2_provider_auth_profiles (
  auth_profile_id uuid primary key default gen_random_uuid(),
  provider_slug text not null references public.v2_providers(provider_slug) on delete cascade,
  profile_key text not null,
  auth_primitive_key text not null references public.v2_adapter_primitives(primitive_key) on delete restrict,
  secret_reference_key text not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_provider_auth_profiles_key unique (provider_slug, profile_key),
  constraint v2_provider_auth_profiles_provider_key unique (provider_slug, auth_profile_id),
  constraint v2_provider_auth_profiles_config_check check (jsonb_typeof(config) = 'object'),
  constraint v2_provider_auth_profiles_status_check check (status in ('active', 'deprecated', 'disabled'))
);

comment on column public.v2_provider_auth_profiles.secret_reference_key is
  'Logical secret lookup key only. Secret values must never be stored in the control plane.';

create table if not exists public.v2_provider_endpoints (
  provider_endpoint_id uuid primary key default gen_random_uuid(),
  provider_slug text not null references public.v2_providers(provider_slug) on delete cascade,
  endpoint_key text not null,
  capability_id text not null,
  base_url text not null,
  path_template text not null,
  api_version text,
  auth_profile_id uuid,
  region_code text,
  service_tier_slug text references public.v2_service_tiers(service_tier_slug) on delete restrict,
  timeout_ms integer not null default 120000,
  retry_policy jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_provider_endpoints_key unique (provider_slug, endpoint_key),
  constraint v2_provider_endpoints_provider_key unique (provider_slug, provider_endpoint_id),
  foreign key (provider_slug, auth_profile_id)
    references public.v2_provider_auth_profiles(provider_slug, auth_profile_id) on delete restrict,
  constraint v2_provider_endpoints_timeout_check check (timeout_ms > 0 and timeout_ms <= 900000),
  constraint v2_provider_endpoints_retry_check check (jsonb_typeof(retry_policy) = 'object'),
  constraint v2_provider_endpoints_status_check check (status in ('active', 'degraded', 'deprecated', 'disabled'))
);

create index if not exists v2_provider_endpoints_lookup_idx
  on public.v2_provider_endpoints (provider_slug, capability_id, region_code, service_tier_slug, status);

create table if not exists public.v2_provider_capability_adapters (
  provider_capability_adapter_id uuid primary key default gen_random_uuid(),
  provider_slug text not null references public.v2_providers(provider_slug) on delete cascade,
  capability_id text not null,
  capability_adapter_id uuid not null references public.v2_capability_adapters(capability_adapter_id) on delete restrict,
  provider_endpoint_id uuid not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  effective_from timestamptz,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_provider_capability_adapters_key unique (provider_slug, capability_id, capability_adapter_id, provider_endpoint_id),
  foreign key (provider_slug, provider_endpoint_id)
    references public.v2_provider_endpoints(provider_slug, provider_endpoint_id) on delete restrict,
  constraint v2_provider_capability_adapters_config_check check (jsonb_typeof(config) = 'object'),
  constraint v2_provider_capability_adapters_status_check check (status in ('draft', 'active', 'deprecated', 'disabled')),
  constraint v2_provider_capability_adapters_window_check check (effective_to is null or effective_from is null or effective_to > effective_from)
);

create index if not exists v2_provider_capability_adapters_lookup_idx
  on public.v2_provider_capability_adapters (provider_slug, capability_id, status);

create table if not exists public.v2_capability_parameters (
  capability_id text not null,
  parameter_key text not null,
  value_schema jsonb not null default '{}'::jsonb,
  description text,
  primary key (capability_id, parameter_key),
  constraint v2_capability_parameters_key_check check (parameter_key ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]*$'),
  constraint v2_capability_parameters_schema_check check (jsonb_typeof(value_schema) = 'object')
);

create table if not exists public.v2_route_parameter_support (
  provider_model_id text not null,
  capability_id text not null,
  parameter_key text not null,
  support_level text not null,
  config jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider_model_id, capability_id, parameter_key),
  foreign key (provider_model_id, capability_id)
    references public.v2_route_capabilities(provider_model_id, capability_id) on delete cascade,
  foreign key (capability_id, parameter_key)
    references public.v2_capability_parameters(capability_id, parameter_key) on delete restrict,
  constraint v2_route_parameter_support_level_check check (support_level in ('native', 'emulated', 'ignored', 'unsupported', 'unknown')),
  constraint v2_route_parameter_support_config_check check (jsonb_typeof(config) = 'object')
);

create index if not exists v2_route_parameter_support_lookup_idx
  on public.v2_route_parameter_support (capability_id, parameter_key, support_level, provider_model_id);

create table if not exists public.v2_capability_constraints (
  constraint_id uuid primary key default gen_random_uuid(),
  provider_slug text references public.v2_providers(provider_slug) on delete cascade,
  provider_model_id text references public.v2_model_provider_routes(provider_model_id) on delete cascade,
  capability_id text not null,
  constraint_key text not null,
  expression jsonb not null,
  outcome text not null default 'reject',
  message text not null,
  priority integer not null default 100,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_capability_constraints_scope_check check (provider_slug is not null or provider_model_id is not null),
  constraint v2_capability_constraints_expression_check check (jsonb_typeof(expression) = 'object'),
  constraint v2_capability_constraints_outcome_check check (outcome in ('reject', 'warn', 'transform')),
  constraint v2_capability_constraints_status_check check (status in ('draft', 'active', 'deprecated', 'disabled')),
  constraint v2_capability_constraints_key unique nulls not distinct (provider_slug, provider_model_id, capability_id, constraint_key)
);

create index if not exists v2_capability_constraints_lookup_idx
  on public.v2_capability_constraints (provider_slug, provider_model_id, capability_id, status, priority);

create table if not exists public.v2_capability_evidence (
  evidence_id uuid primary key default gen_random_uuid(),
  provider_slug text references public.v2_providers(provider_slug) on delete cascade,
  provider_model_id text references public.v2_model_provider_routes(provider_model_id) on delete cascade,
  capability_id text not null,
  parameter_key text,
  source_url text not null,
  source_type text not null default 'official_docs',
  checked_at timestamptz not null,
  confidence text not null default 'confirmed',
  source_hash text,
  notes text,
  created_at timestamptz not null default now(),
  constraint v2_capability_evidence_scope_check check (provider_slug is not null or provider_model_id is not null),
  constraint v2_capability_evidence_source_check check (source_url ~ '^https://'),
  constraint v2_capability_evidence_type_check check (source_type in ('official_docs', 'official_sdk', 'live_test', 'provider_support', 'inference')),
  constraint v2_capability_evidence_confidence_check check (confidence in ('confirmed', 'high', 'medium', 'low'))
);

create index if not exists v2_capability_evidence_lookup_idx
  on public.v2_capability_evidence (provider_slug, provider_model_id, capability_id, checked_at desc);

create table if not exists public.v2_control_plane_releases (
  release_id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity unique,
  status text not null default 'draft',
  change_summary text not null,
  content_hash text,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  superseded_at timestamptz,
  constraint v2_control_plane_releases_status_check check (status in ('draft', 'validated', 'published', 'superseded', 'rejected')),
  constraint v2_control_plane_releases_review_check check (reviewed_by is null or created_by is null or reviewed_by <> created_by),
  constraint v2_control_plane_releases_publish_check check (status <> 'published' or (reviewed_by is not null and published_at is not null and content_hash is not null))
);

create unique index if not exists v2_control_plane_single_published_idx
  on public.v2_control_plane_releases ((status)) where status = 'published';

create unique index if not exists v2_route_variants_provider_variant_idx
  on public.v2_route_variants (provider_model_id, variant_id);

create table if not exists public.v2_execution_plans (
  execution_plan_id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.v2_control_plane_releases(release_id) on delete cascade,
  provider_model_id text not null references public.v2_model_provider_routes(provider_model_id) on delete cascade,
  capability_id text not null,
  route_variant_id uuid,
  plan_version integer not null default 1,
  plan_hash text not null,
  plan jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (provider_model_id, capability_id)
    references public.v2_route_capabilities(provider_model_id, capability_id) on delete cascade,
  foreign key (provider_model_id, route_variant_id)
    references public.v2_route_variants(provider_model_id, variant_id) on delete cascade,
  constraint v2_execution_plans_key unique nulls not distinct (release_id, provider_model_id, capability_id, route_variant_id),
  constraint v2_execution_plans_version_check check (plan_version > 0),
  constraint v2_execution_plans_plan_check check (jsonb_typeof(plan) = 'object')
);

create index if not exists v2_execution_plans_runtime_lookup_idx
  on public.v2_execution_plans (release_id, provider_model_id, capability_id, route_variant_id);

create or replace function public.prevent_published_control_plane_release_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'published' then
    if tg_op = 'UPDATE'
      and new.status = 'superseded'
      and new.superseded_at is not null
      and (to_jsonb(new) - 'status' - 'superseded_at') =
        (to_jsonb(old) - 'status' - 'superseded_at') then
      return new;
    end if;
    raise exception 'Published control-plane releases are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger prevent_published_control_plane_release_mutation
  before update or delete on public.v2_control_plane_releases
  for each row execute function public.prevent_published_control_plane_release_mutation();

create or replace function public.prevent_published_execution_plan_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  old_release_status text;
  new_release_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select status into old_release_status
      from public.v2_control_plane_releases where release_id = old.release_id;
    if old_release_status = 'published' then
      raise exception 'Execution plans in published releases are immutable';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select status into new_release_status
      from public.v2_control_plane_releases where release_id = new.release_id;
    if new_release_status = 'published' then
      raise exception 'Execution plans in published releases are immutable';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger prevent_published_execution_plan_mutation
  before insert or update or delete on public.v2_execution_plans
  for each row execute function public.prevent_published_execution_plan_mutation();

revoke all on function public.prevent_published_control_plane_release_mutation() from public, anon, authenticated;
revoke all on function public.prevent_published_execution_plan_mutation() from public, anon, authenticated;

alter table public.v2_adapter_primitives enable row level security;
alter table public.v2_capability_adapters enable row level security;
alter table public.v2_provider_auth_profiles enable row level security;
alter table public.v2_provider_endpoints enable row level security;
alter table public.v2_provider_capability_adapters enable row level security;
alter table public.v2_capability_parameters enable row level security;
alter table public.v2_route_parameter_support enable row level security;
alter table public.v2_capability_constraints enable row level security;
alter table public.v2_capability_evidence enable row level security;
alter table public.v2_control_plane_releases enable row level security;
alter table public.v2_execution_plans enable row level security;

revoke all on public.v2_adapter_primitives from anon, authenticated;
revoke all on public.v2_capability_adapters from anon, authenticated;
revoke all on public.v2_provider_auth_profiles from anon, authenticated;
revoke all on public.v2_provider_endpoints from anon, authenticated;
revoke all on public.v2_provider_capability_adapters from anon, authenticated;
revoke all on public.v2_capability_parameters from anon, authenticated;
revoke all on public.v2_route_parameter_support from anon, authenticated;
revoke all on public.v2_capability_constraints from anon, authenticated;
revoke all on public.v2_capability_evidence from anon, authenticated;
revoke all on public.v2_control_plane_releases from anon, authenticated;
revoke all on public.v2_execution_plans from anon, authenticated;

grant all on public.v2_adapter_primitives to service_role;
grant all on public.v2_capability_adapters to service_role;
grant all on public.v2_provider_auth_profiles to service_role;
grant all on public.v2_provider_endpoints to service_role;
grant all on public.v2_provider_capability_adapters to service_role;
grant all on public.v2_capability_parameters to service_role;
grant all on public.v2_route_parameter_support to service_role;
grant all on public.v2_capability_constraints to service_role;
grant all on public.v2_capability_evidence to service_role;
grant all on public.v2_control_plane_releases to service_role;
grant all on public.v2_execution_plans to service_role;
grant usage, select on sequence public.v2_control_plane_releases_sequence_seq to service_role;

comment on table public.v2_adapter_primitives is 'Allowlisted, code-owned protocol mechanics available to the control-plane compiler.';
comment on table public.v2_provider_capability_adapters is 'Provider-by-capability composition of adapter mechanics, endpoint and declarative policy.';
comment on table public.v2_route_parameter_support is 'Truth table distinguishing native, emulated, ignored, unsupported and unknown parameter support.';
comment on table public.v2_capability_constraints is 'Declarative compatibility rules interpreted by an allowlisted, fail-closed expression engine.';
comment on table public.v2_execution_plans is 'Immutable, compiled data-plane input. Gateway runtime must not interpret draft control-plane rows.';
