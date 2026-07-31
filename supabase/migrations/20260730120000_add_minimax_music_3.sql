-- Add the paid MiniMax Music 3.0 route from the official 2026-07-16 release
-- and API documentation. The free provider variant is intentionally not offered.

insert into public.v2_models (
  model_slug, lab_slug, name, description, status, input_modalities,
  output_modalities, announced_at, released_at, metadata
)
values (
  'minimax/music-3.0', 'minimax', 'Music 3.0',
  'MiniMax music-generation model for complete vocal or instrumental tracks from prompts and optional lyrics.',
  'active', array['text'], array['audio_music'],
  '2026-07-16T00:00:00Z', '2026-07-16T00:00:00Z',
  '{"source_url":"https://platform.minimax.io/docs/release-notes/models","api_reference":"https://platform.minimax.io/docs/api-reference/music-generation","maximum_track_duration_seconds":300}'::jsonb
)
on conflict (model_slug) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  input_modalities = excluded.input_modalities,
  output_modalities = excluded.output_modalities,
  announced_at = excluded.announced_at,
  released_at = excluded.released_at,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.v2_model_provider_routes (
  provider_model_id, model_slug, provider_slug, provider_model_slug, status,
  routing_enabled, input_modalities, output_modalities, effective_from, metadata
)
values (
  'minimax:minimax/music-3.0', 'minimax/music-3.0', 'minimax', 'music-3.0',
  'active', false, array['text'], array['music'], '2026-07-16T00:00:00Z',
  '{"endpoint":"/v1/music_generation","rate_limit_rpm":120,"provider_status":"available","phaseo_status":"unsupported","gateway_note":"Phaseo music generation routes remain unimplemented."}'::jsonb
)
on conflict (provider_model_id) do update set
  model_slug = excluded.model_slug,
  provider_slug = excluded.provider_slug,
  provider_model_slug = excluded.provider_model_slug,
  status = excluded.status,
  routing_enabled = excluded.routing_enabled,
  input_modalities = excluded.input_modalities,
  output_modalities = excluded.output_modalities,
  effective_from = excluded.effective_from,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.v2_route_capabilities (
  provider_model_id, capability_id, status, params, effective_from, metadata
)
values (
  'minimax:minimax/music-3.0', 'music.generate', 'active',
  '{"prompt":{},"lyrics":{},"is_instrumental":{},"duration":{}}'::jsonb,
  '2026-07-16T00:00:00Z', '{}'::jsonb
)
on conflict (provider_model_id, capability_id) do update set
  status = excluded.status,
  params = excluded.params,
  effective_from = excluded.effective_from,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.v2_service_tiers (service_tier_slug, display_name, metadata)
values ('standard', 'Standard', '{"source":"minimax_music_3"}'::jsonb)
on conflict (service_tier_slug) do update set
  display_name = excluded.display_name,
  metadata = public.v2_service_tiers.metadata || excluded.metadata,
  updated_at = now();

insert into public.v2_meter_definitions (
  meter_key, display_name, modality, direction, unit,
  default_unit_quantity, description, status, metadata
)
values (
  'requests', 'Generated tracks', 'audio', null, 'request',
  1, 'One generated music track of up to five minutes.', 'active',
  '{"source":"minimax_music_3"}'::jsonb
)
on conflict (meter_key) do nothing;

insert into public.v2_pricing_skus (
  provider_model_id, sku_code, version, operation, status, display_name,
  description, currency, effective_from, effective_to, service_tier_slug, metadata
)
values (
  'minimax:minimax/music-3.0', 'payg', 1, 'music.generate', 'active',
  'Music 3.0 pay as you go', '$0.15 per generated track up to five minutes.',
  'USD', '2026-07-16T00:00:00Z', null, 'standard',
  '{"source_url":"https://platform.minimax.io/docs/guides/pricing-paygo"}'::jsonb
)
on conflict (provider_model_id, sku_code, version) do update set
  operation = excluded.operation,
  status = excluded.status,
  display_name = excluded.display_name,
  description = excluded.description,
  currency = excluded.currency,
  effective_from = excluded.effective_from,
  effective_to = excluded.effective_to,
  service_tier_slug = excluded.service_tier_slug,
  metadata = public.v2_pricing_skus.metadata || excluded.metadata,
  updated_at = now();

insert into public.v2_pricing_sku_meters (
  sku_id, meter_key, modality, direction, unit, unit_quantity, price_nanos,
  display_label, display_unit, metadata
)
select
  sku.sku_id, 'requests', 'audio', null, 'request', 1, 150000000,
  'Generated tracks', '1 track (up to 5 minutes)',
  '{"source":"minimax_music_3"}'::jsonb
from public.v2_pricing_skus sku
where sku.provider_model_id = 'minimax:minimax/music-3.0'
  and sku.sku_code = 'payg'
  and sku.version = 1
on conflict (sku_id, meter_key) do update set
  modality = excluded.modality,
  direction = excluded.direction,
  unit = excluded.unit,
  unit_quantity = excluded.unit_quantity,
  price_nanos = excluded.price_nanos,
  display_label = excluded.display_label,
  display_unit = excluded.display_unit,
  metadata = public.v2_pricing_sku_meters.metadata || excluded.metadata;
