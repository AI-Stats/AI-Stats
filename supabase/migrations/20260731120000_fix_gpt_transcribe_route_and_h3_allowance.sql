-- Repair catalogue projections introduced with GPT Transcribe and MiniMax H3.
-- The importer now preserves included_quantity; this migration also repairs
-- databases before their next catalogue sync.

insert into public.v2_route_variants (
  provider_model_id, variant_key, service_tier_slug, status,
  routing_enabled, endpoint_label, metadata
)
select
  route.provider_model_id,
  'global:standard',
  'standard',
  route.status,
  route.routing_enabled,
  'Standard',
  '{"source":"gpt_transcribe_route_fix"}'::jsonb
from public.v2_model_provider_routes route
where route.provider_model_id = 'openai:openai/gpt-transcribe'
on conflict (provider_model_id, variant_key) do update set
  service_tier_slug = excluded.service_tier_slug,
  status = excluded.status,
  routing_enabled = excluded.routing_enabled,
  endpoint_label = excluded.endpoint_label,
  metadata = public.v2_route_variants.metadata || excluded.metadata,
  updated_at = now();

update public.v2_pricing_skus sku
set route_variant_id = variant.variant_id,
    updated_at = now()
from public.v2_route_variants variant
where sku.provider_model_id = 'openai:openai/gpt-transcribe'
  and variant.provider_model_id = sku.provider_model_id
  and variant.variant_key = 'global:standard'
  and variant.service_tier_slug = coalesce(sku.service_tier_slug, 'standard')
  and sku.route_variant_id is distinct from variant.variant_id;

update public.v2_pricing_sku_meters meter
set metadata = jsonb_set(
      coalesce(meter.metadata, '{}'::jsonb),
      '{included_quantity}',
      '5'::jsonb,
      true
    ),
    updated_at = now()
from public.v2_pricing_skus sku
where meter.sku_id = sku.sku_id
  and sku.provider_model_id = 'minimax:minimax/h3'
  and meter.meter_key = 'input_image';
