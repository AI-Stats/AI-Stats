alter table if exists public.v2_model_provider_routes
  alter column provider_model_slug drop not null;

alter table if exists public.v2_model_provider_routes
  add constraint v2_model_provider_routes_provider_model_slug_check
  check (
    provider_model_slug is not null
    or (status = 'disabled' and routing_enabled = false)
  );
