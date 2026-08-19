-- Add indexes for high-value foreign keys on active catalogue, observability,
-- usage, and gateway tables. Nullable foreign keys use partial indexes so null
-- rows do not consume index space while parent updates/deletes remain indexed.

-- Defining these indexes on the partitioned parents creates matching indexes
-- on every existing gateway partition and future partitions.
create index if not exists gateway_requests_key_id_idx
  on public.gateway_requests (key_id)
  where key_id is not null;

create index if not exists gateway_upstream_requests_app_id_idx
  on public.gateway_upstream_requests (app_id)
  where app_id is not null;

create index if not exists v2_request_facts_key_id_idx
  on public.v2_request_facts (key_id)
  where key_id is not null;

create index if not exists v2_request_usage_sku_meter_id_idx
  on public.v2_request_usage (sku_meter_id)
  where sku_meter_id is not null;

create index if not exists v2_request_pricing_lines_sku_meter_id_idx
  on public.v2_request_pricing_lines (sku_meter_id)
  where sku_meter_id is not null;

create index if not exists v2_pricing_skus_route_variant_id_idx
  on public.v2_pricing_skus (route_variant_id)
  where route_variant_id is not null;

create index if not exists v2_pricing_skus_service_tier_slug_idx
  on public.v2_pricing_skus (service_tier_slug)
  where service_tier_slug is not null;

create index if not exists v2_route_variants_provider_region_id_idx
  on public.v2_route_variants (provider_region_id)
  where provider_region_id is not null;

create index if not exists v2_route_variants_service_tier_slug_idx
  on public.v2_route_variants (service_tier_slug);

create index if not exists model_discovery_seen_models_last_run_id_idx
  on public.model_discovery_seen_models (last_run_id)
  where last_run_id is not null;

create index if not exists v2_private_usage_daily_provider_model_id_idx
  on public.v2_private_usage_daily (provider_model_id)
  where provider_model_id is not null;

create index if not exists v2_public_usage_hourly_app_id_idx
  on public.v2_public_usage_hourly (app_id)
  where app_id is not null;
