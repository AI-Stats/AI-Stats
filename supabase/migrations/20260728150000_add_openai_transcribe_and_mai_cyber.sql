-- Add the 2026-07-28 OpenAI transcription releases and MAI Cyber 1 Flash.
-- Only GPT Transcribe uses an existing Phaseo gateway surface. Realtime
-- transcription and MDASH-restricted access remain catalogue-only.

insert into public.v2_models (
  model_slug, lab_slug, name, description, status, input_modalities,
  output_modalities, announced_at, released_at, metadata
)
values
  (
    'openai/gpt-transcribe', 'openai', 'GPT Transcribe',
    'OpenAI high-accuracy speech-to-text model for completed audio files, streamed file transcripts, and committed Realtime turns.',
    'active', array['text', 'audio'], array['text', 'audio_stt'],
    '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z',
    '{"source_url":"https://developers.openai.com/api/docs/models/gpt-transcribe"}'::jsonb
  ),
  (
    'openai/gpt-live-transcribe', 'openai', 'GPT Live Transcribe',
    'OpenAI low-latency streaming speech-to-text model for Realtime transcription sessions.',
    'active', array['text', 'audio'], array['text', 'audio_stt'],
    '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z',
    '{"source_url":"https://developers.openai.com/api/docs/models/gpt-live-transcribe","gateway_note":"Catalogue-only pending Phaseo Realtime transcription-session support."}'::jsonb
  ),
  (
    'microsoft/mai-cyber-1-flash', 'microsoft', 'MAI Cyber 1 Flash',
    'Microsoft compact specialist cybersecurity model for finding vulnerabilities in complex codebases.',
    'active', array['text'], array['text'],
    '2026-07-27T00:00:00Z', '2026-07-27T00:00:00Z',
    '{"source_url":"https://microsoft.ai/news/introducing-mai-cyber-1-flash-inside-mdash/","availability":"Restricted to verified defenders through MDASH; no general-purpose API."}'::jsonb
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
values
  (
    'openai:openai/gpt-transcribe', 'openai/gpt-transcribe', 'openai', 'gpt-transcribe',
    'active', true, array['text', 'audio'], array['text', 'audio_stt'],
    '2026-07-28T00:00:00Z',
    '{"endpoint":"/v1/audio/transcriptions","format":"multipart/form-data","verification":"OpenAI documents the model on the endpoint; Phaseo OpenAI audio.transcription executor is enabled."}'::jsonb
  ),
  (
    'openai:openai/gpt-live-transcribe', 'openai/gpt-live-transcribe', 'openai', 'gpt-live-transcribe',
    'active', false, array['text', 'audio'], array['text', 'audio_stt'],
    '2026-07-28T00:00:00Z',
    '{"endpoint":"/v1/realtime/transcription_sessions","verification":"Provider route exists; Phaseo gateway surface is not implemented."}'::jsonb
  ),
  (
    'azure:microsoft/mai-cyber-1-flash', 'microsoft/mai-cyber-1-flash', 'azure', 'mai-cyber-1-flash',
    'active', false, array['text'], array['text'],
    '2026-07-27T00:00:00Z',
    '{"verification":"No public Azure inference endpoint is documented; access is restricted to MDASH."}'::jsonb
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
values
  (
    'openai:openai/gpt-transcribe', 'audio.transcription', 'active',
    '{"language":{},"prompt":{"notes":"Supports free-form context and keyword hints."},"response_format":{}}'::jsonb,
    '2026-07-28T00:00:00Z', '{}'::jsonb
  ),
  (
    'openai:openai/gpt-live-transcribe', 'audio.realtime', 'active',
    '{}'::jsonb, '2026-07-28T00:00:00Z',
    '{"gateway_status":"not_routable"}'::jsonb
  ),
  (
    'azure:microsoft/mai-cyber-1-flash', 'text.generate', 'active',
    '{}'::jsonb, '2026-07-27T00:00:00Z',
    '{"gateway_status":"not_routable","access":"MDASH verified defenders only"}'::jsonb
  )
on conflict (provider_model_id, capability_id) do update set
  status = excluded.status,
  params = excluded.params,
  effective_from = excluded.effective_from,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.v2_service_tiers (service_tier_slug, display_name, metadata)
values ('standard', 'Standard', '{"source":"openai_gpt_transcribe"}'::jsonb)
on conflict (service_tier_slug) do update set
  display_name = excluded.display_name,
  metadata = public.v2_service_tiers.metadata || excluded.metadata,
  updated_at = now();

insert into public.v2_pricing_skus (
  provider_model_id, sku_code, version, operation, status, display_name,
  description, currency, effective_from, effective_to, service_tier_slug, metadata
)
values (
  'openai:openai/gpt-transcribe', 'payg', 1, 'audio.transcription', 'active',
  'GPT Transcribe pay as you go', '$0.0045 per minute of transcription audio.',
  'USD', '2026-07-28T00:00:00Z', null, 'standard',
  '{"source_url":"https://developers.openai.com/api/docs/models/gpt-transcribe"}'::jsonb
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
  sku.sku_id, 'input_audio_seconds', 'audio', 'input', 'second', 60, 4500000,
  'Transcription audio', '60 seconds',
  '{"source":"openai_gpt_transcribe"}'::jsonb
from public.v2_pricing_skus sku
where sku.provider_model_id = 'openai:openai/gpt-transcribe'
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
