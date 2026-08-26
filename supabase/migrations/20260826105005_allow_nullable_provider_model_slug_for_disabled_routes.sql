alter table if exists public.v2_model_provider_routes
  alter column provider_model_slug drop not null;
