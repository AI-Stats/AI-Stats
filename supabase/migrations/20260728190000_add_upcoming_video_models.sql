-- Record MiniMax H3's official release alongside the remaining rumoured next-generation video models.
-- H3's provider route and pricing are catalogued below, but Phaseo routing stays disabled pending a V2 adapter.

insert into public.v2_models (
  model_slug, lab_slug, name, description, status, hidden, input_modalities,
  output_modalities, announced_at, released_at, metadata
)
values
  ('minimax/h3', 'minimax', 'MiniMax H3', 'Next-generation general-purpose multimodal video model for generation, reference-based creation and video editing.', 'active', false, array['text','image','video','audio'], array['video'], '2026-07-31T00:00:00Z', '2026-07-31T00:00:00Z', '{"source_url":"https://platform.minimax.io/docs/release-notes/models","api_reference":"https://platform.minimax.io/docs/guides/video-generation","max_resolution":"2K","duration_seconds":{"min":5,"max":15},"fps":24,"gateway_status":"not_routable","gateway_note":"MiniMax H3 uses the new V2 multimodal content-array API."}'::jsonb),
  ('black-forest-labs/flux-3', 'black-forest-labs', 'FLUX 3', 'Rumoured next-generation Black Forest Labs video model; final specifications and modalities remain unconfirmed.', 'draft', false, array['text','image'], array['video'], '2026-07-28T00:00:00Z', null, '{"release_status":"rumoured","gateway_status":"not_routable","evidence_status":"maintainer-supplied rumour","modality_status":"unconfirmed"}'::jsonb),
  ('bytedance/seedance-2.5', 'bytedance', 'Seedance 2.5', 'Rumoured next-generation ByteDance video model.', 'draft', false, array['text','image','video','audio'], array['video','audio'], '2026-06-23T00:00:00Z', null, '{"release_status":"rumoured","gateway_status":"not_routable","evidence_status":"maintainer-supplied rumour"}'::jsonb)
on conflict (model_slug) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  hidden = excluded.hidden,
  input_modalities = excluded.input_modalities,
  output_modalities = excluded.output_modalities,
  announced_at = excluded.announced_at,
  released_at = excluded.released_at,
  metadata = excluded.metadata,
  updated_at = now();


-- MiniMax exposes H3 through a new V2 multimodal video endpoint. The provider
-- route is available, but Phaseo routing is disabled until the adapter supports
-- content[] media inputs and the V2 query/result lifecycle.
insert into public.v2_model_provider_routes (
  provider_model_id, model_slug, provider_slug, provider_model_slug, status,
  routing_enabled, input_modalities, output_modalities, effective_from, metadata
)
values (
  'minimax:minimax/h3', 'minimax/h3', 'minimax', 'MiniMax-H3', 'active',
  false, array['text','image','video','audio'], array['video'],
  '2026-07-31T00:00:00Z',
  '{"endpoint":"/v2/video_generation","provider_status":"available","phaseo_status":"unsupported","max_resolution":"2K","duration_seconds":{"min":5,"max":15},"fps":24,"gateway_note":"Awaiting MiniMax V2 multimodal adapter and authenticated smoke test."}'::jsonb
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
  'minimax:minimax/h3', 'video.generate', 'active',
  '{"prompt":{"type":"string","max_length":7000},"duration":{"type":"number","min":5,"max":15},"resolution":{"type":"enum","values":["768P","2K"]},"ratio":{"type":"string"},"content":{"type":"array","item_types":["text","image_url","video_url","audio_url"]}}'::jsonb,
  '2026-07-31T00:00:00Z',
  '{"modes":["text-to-video","image-to-video","first-last-frame","reference-to-video","video-editing"],"gateway_status":"not_routable"}'::jsonb
)
on conflict (provider_model_id, capability_id) do update set
  status = excluded.status,
  params = excluded.params,
  effective_from = excluded.effective_from,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.v2_service_tiers (service_tier_slug, display_name, metadata)
values ('standard', 'Standard', '{"source":"minimax_h3"}'::jsonb)
on conflict (service_tier_slug) do update set
  display_name = excluded.display_name,
  metadata = public.v2_service_tiers.metadata || excluded.metadata,
  updated_at = now();

insert into public.v2_pricing_skus (
  provider_model_id, sku_code, version, operation, status, display_name,
  description, currency, effective_from, effective_to, service_tier_slug, metadata
)
values
  (
    'minimax:minimax/h3', 'payg-2k', 1, 'video.generate', 'active',
    'MiniMax H3 2K', '$0.13 per output second; reference video input is billed at the same per-second rate.',
    'USD', '2026-07-31T00:00:00Z', null, 'standard',
    '{"resolution":"2K","match":[{"path":"video_params.resolution","op":"eq","or_group":1,"and_index":1,"value":"2K"}],"source_url":"https://platform.minimax.io/docs/guides/pricing-paygo"}'::jsonb
  ),
  (
    'minimax:minimax/h3', 'payg-768p', 1, 'video.generate', 'active',
    'MiniMax H3 768P', '$0.09 per output second; reference video input is billed at the same per-second rate.',
    'USD', '2026-07-31T00:00:00Z', null, 'standard',
    '{"resolution":"768P","match":[{"path":"video_params.resolution","op":"eq","or_group":1,"and_index":1,"value":"768P"}],"source_url":"https://platform.minimax.io/docs/guides/pricing-paygo"}'::jsonb
  ),
  (
    'minimax:minimax/h3', 'input-image-overage', 1, 'video.generate', 'active',
    'MiniMax H3 input image overage', '$0.04 for each input image after the first five.',
    'USD', '2026-07-31T00:00:00Z', null, 'standard',
    '{"included_images":5,"input_audio_price":"free","source_url":"https://platform.minimax.io/docs/guides/pricing-paygo"}'::jsonb
  ),
  (
    'minimax:minimax/h3', 'input-audio-free', 1, 'video.generate', 'active',
    'MiniMax H3 input audio', 'Input audio is free.',
    'USD', '2026-07-31T00:00:00Z', null, 'standard',
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
select sku.sku_id, meter.meter_key, meter.modality, meter.direction, meter.unit,
       meter.unit_quantity, meter.price_nanos, meter.display_label,
       meter.display_unit, meter.metadata
from public.v2_pricing_skus sku
join (
  values
    ('payg-2k', 'output_video_seconds', 'video', 'output', 'second', 1::numeric, 130000000::bigint, 'Output video', '1 second', '{"resolution":"2K","match":[{"path":"video_params.resolution","op":"eq","or_group":1,"and_index":1,"value":"2K"}]}'::jsonb),
    ('payg-2k', 'input_video_seconds', 'video', 'input', 'second', 1::numeric, 130000000::bigint, 'Reference video input', '1 second', '{"resolution":"2K","match":[{"path":"video_params.resolution","op":"eq","or_group":1,"and_index":1,"value":"2K"}]}'::jsonb),
    ('payg-768p', 'output_video_seconds', 'video', 'output', 'second', 1::numeric, 90000000::bigint, 'Output video', '1 second', '{"resolution":"768P","match":[{"path":"video_params.resolution","op":"eq","or_group":1,"and_index":1,"value":"768P"}]}'::jsonb),
    ('payg-768p', 'input_video_seconds', 'video', 'input', 'second', 1::numeric, 90000000::bigint, 'Reference video input', '1 second', '{"resolution":"768P","match":[{"path":"video_params.resolution","op":"eq","or_group":1,"and_index":1,"value":"768P"}]}'::jsonb),
    ('input-image-overage', 'input_image', 'image', 'input', 'image', 1::numeric, 40000000::bigint, 'Input image overage', '1 image after 5 included', '{"included_quantity":5}'::jsonb),
    ('input-audio-free', 'input_audio_seconds', 'audio', 'input', 'second', 1::numeric, 0::bigint, 'Input audio', '1 second', '{}'::jsonb)
) as meter(sku_code, meter_key, modality, direction, unit, unit_quantity, price_nanos, display_label, display_unit, metadata)
  on meter.sku_code = sku.sku_code
where sku.provider_model_id = 'minimax:minimax/h3'
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
