-- Remove the floating grok-voice-latest alias from canonical catalogue data.
-- Phaseo exposes pinned model versions so routing and pricing cannot change silently.

delete from public.data_api_pricing_rules
where model_key in (
  'x-ai:x-ai/grok-voice-latest:audio.realtime',
  'spacex-ai:x-ai/grok-voice-latest:audio.realtime'
);

delete from public.data_api_provider_model_capabilities
where provider_api_model_id in (
  'x-ai:x-ai/grok-voice-latest',
  'spacex-ai:x-ai/grok-voice-latest'
);

delete from public.data_api_provider_models
where provider_api_model_id in (
  'x-ai:x-ai/grok-voice-latest',
  'spacex-ai:x-ai/grok-voice-latest'
)
or provider_model_slug = 'grok-voice-latest';

delete from public.data_model_details
where model_id in ('x-ai/grok-voice-latest', 'spacex-ai/grok-voice-latest');

delete from public.data_model_links
where model_id in ('x-ai/grok-voice-latest', 'spacex-ai/grok-voice-latest');

delete from public.data_models
where model_id in ('x-ai/grok-voice-latest', 'spacex-ai/grok-voice-latest');

-- Add Grok Voice Think Fast 2.0 as a pinned, gateway-routable realtime model.
-- Phaseo exposes the pinned version rather than xAI's floating latest alias.

insert into public.data_models (
  model_id, name, description, organisation_id, status, announcement_date,
  release_date, license, input_types, output_types, previous_model_id, hidden
) values (
  'x-ai/grok-voice-think-fast-2.0',
  'Grok Voice Think Fast 2.0',
  'xAI''s next-generation realtime speech-to-speech model with improved reasoning, transcription accuracy, conversational ability and tool-use reliability.',
  'x-ai', 'Available', '2026-07-29T00:00:00Z', '2026-07-29T00:00:00Z',
  'Proprietary', 'text,audio', 'text,audio', 'x-ai/grok-voice-latest', false
)
on conflict (model_id) do update set
  name=excluded.name, description=excluded.description, status=excluded.status,
  announcement_date=excluded.announcement_date, release_date=excluded.release_date,
  input_types=excluded.input_types, output_types=excluded.output_types,
  previous_model_id=excluded.previous_model_id, hidden=excluded.hidden, updated_at=now();

insert into public.data_model_links (model_id, platform, url) values
 ('x-ai/grok-voice-think-fast-2.0','announcement','https://x.ai/news/grok-voice-think-fast-2'),
 ('x-ai/grok-voice-think-fast-2.0','api_reference','https://docs.x.ai/developers/model-capabilities/audio/voice-agent'),
 ('x-ai/grok-voice-think-fast-2.0','pricing','https://docs.x.ai/developers/pricing')
on conflict do nothing;

insert into public.data_api_provider_models (
 provider_api_model_id, provider_id, api_model_id, provider_model_slug,
 internal_model_id, is_active_gateway, input_modalities, output_modalities,
 effective_from, effective_to
) values (
 'x-ai:x-ai/grok-voice-think-fast-2.0','x-ai','x-ai/grok-voice-think-fast-2.0',
 'grok-voice-think-fast-2.0','x-ai/grok-voice-think-fast-2.0',true,
 array['text','audio'],array['text','audio'],'2026-07-29T00:00:00Z',null
)
on conflict (provider_api_model_id) do update set
 provider_model_slug=excluded.provider_model_slug, internal_model_id=excluded.internal_model_id,
 is_active_gateway=true, input_modalities=excluded.input_modalities,
 output_modalities=excluded.output_modalities, effective_from=excluded.effective_from,
 effective_to=null, updated_at=now();

insert into public.data_api_provider_model_capabilities (
 provider_api_model_id, capability_id, params, status
) values (
 'x-ai:x-ai/grok-voice-think-fast-2.0','audio.realtime',
 '{"reasoning_effort":{"type":"enum","default":"high","values":["high","none"]},"tools":{"supported":true}}'::jsonb,
 'active'
)
on conflict (provider_api_model_id, capability_id) do update set
 params=excluded.params,status=excluded.status,updated_at=now();

delete from public.data_api_pricing_rules
where model_key='x-ai:x-ai/grok-voice-think-fast-2.0:audio.realtime'
and capability_id='audio.realtime';

insert into public.data_api_pricing_rules (
 model_key, capability_id, pricing_plan, meter, unit, unit_size, price_per_unit,
 currency, note, match, priority, effective_from, effective_to
) values
 ('x-ai:x-ai/grok-voice-think-fast-2.0:audio.realtime','audio.realtime','standard',
  'audio_minutes','minute',1,0.08,'USD','Grok Voice Think Fast 2.0 audio sent or received.',
  '[]'::jsonb,100,'2026-07-29T00:00:00Z',null),
 ('x-ai:x-ai/grok-voice-think-fast-2.0:audio.realtime','audio.realtime','standard',
  'input_text_messages','message',1,0.004,'USD','Realtime text input message.',
  '[]'::jsonb,100,'2026-07-29T00:00:00Z',null);
