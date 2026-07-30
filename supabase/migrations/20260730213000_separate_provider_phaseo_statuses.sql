-- Separate provider-offer availability from Phaseo integration readiness.
--
-- Existing lifecycle and routing columns remain in place for compatibility.
-- The new fields are additive and fail closed for newly-authored unknown values.

alter table public.v2_models
  add column if not exists catalogue_status text not null default 'unknown';

alter table public.v2_models
  drop constraint if exists v2_models_catalogue_status_check;

alter table public.v2_models
  add constraint v2_models_catalogue_status_check check (
    catalogue_status in (
      'unknown',
      'rumoured',
      'announced',
      'preview',
      'available',
      'limited_access',
      'deprecated',
      'retired',
      'withheld'
    )
  );

update public.v2_models
set catalogue_status = case status
  when 'active' then 'available'
  when 'draft' then 'announced'
  when 'deprecated' then 'deprecated'
  when 'retired' then 'retired'
  when 'disabled' then 'withheld'
  else 'unknown'
end
where catalogue_status = 'unknown';

alter table public.v2_model_provider_routes
  add column if not exists provider_availability_status text not null default 'unknown',
  add column if not exists phaseo_status text not null default 'disabled';

alter table public.v2_model_provider_routes
  drop constraint if exists v2_model_provider_routes_provider_availability_check,
  drop constraint if exists v2_model_provider_routes_phaseo_status_check,
  drop constraint if exists v2_model_provider_routes_phaseo_routing_check,
  drop constraint if exists v2_model_provider_routes_provider_routing_check;

alter table public.v2_model_provider_routes
  add constraint v2_model_provider_routes_provider_availability_check check (
    provider_availability_status in (
      'unknown',
      'coming_soon',
      'preview',
      'available',
      'limited_access',
      'deprecated',
      'removed'
    )
  ),
  add constraint v2_model_provider_routes_phaseo_status_check check (
    phaseo_status in (
      'unsupported',
      'planned',
      'implementing',
      'testing',
      'enabled',
      'disabled',
      'blocked'
    )
  );

update public.v2_model_provider_routes as route
set provider_availability_status = case
  when route.status = 'retired' then 'removed'
  when exists (
    select 1
    from public.v2_route_capabilities as capability
    where capability.provider_model_id = route.provider_model_id
      and (
        capability.status = 'internal_testing'
        or lower(coalesce(capability.metadata->'capability_evidence'->>'status', '')) = 'coming_soon'
      )
  ) then 'coming_soon'
  else 'available'
end
where route.provider_availability_status = 'unknown';

update public.v2_model_provider_routes as route
set phaseo_status = case
  when route.routing_enabled then 'enabled'
  when exists (
    select 1
    from public.v2_route_capabilities as capability
    where capability.provider_model_id = route.provider_model_id
      and capability.status = 'internal_testing'
  ) then 'testing'
  when exists (
    select 1
    from public.v2_route_capabilities as capability
    where capability.provider_model_id = route.provider_model_id
      and lower(coalesce(capability.metadata->'capability_evidence'->>'status', '')) = 'coming_soon'
  ) then 'planned'
  else 'disabled'
end
where route.phaseo_status = 'disabled';

update public.v2_model_provider_routes
set routing_enabled = false
where phaseo_status <> 'enabled'
   or provider_availability_status not in ('available', 'preview', 'limited_access');

alter table public.v2_model_provider_routes
  add constraint v2_model_provider_routes_phaseo_routing_check check (
    not routing_enabled or phaseo_status = 'enabled'
  ),
  add constraint v2_model_provider_routes_provider_routing_check check (
    not routing_enabled
    or provider_availability_status in ('available', 'preview', 'limited_access')
  );

create index if not exists v2_models_catalogue_status_idx
  on public.v2_models (catalogue_status, hidden, model_slug);

create index if not exists v2_model_provider_routes_explicit_status_idx
  on public.v2_model_provider_routes (
    model_slug,
    provider_availability_status,
    phaseo_status,
    routing_enabled
  );

comment on column public.v2_models.catalogue_status is
  'Canonical model lifecycle; independent of provider offers and Phaseo routing.';

comment on column public.v2_model_provider_routes.provider_availability_status is
  'Upstream provider offer availability; does not imply Phaseo support.';

comment on column public.v2_model_provider_routes.phaseo_status is
  'Phaseo integration readiness. Only enabled routes may set routing_enabled=true.';
