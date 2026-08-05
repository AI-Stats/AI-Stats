-- Add Alibaba HappyHorse 1.0 and 1.1 with their documented Model Studio
-- endpoints. Routes remain disabled until the Wan-specific Alibaba video
-- mapper supports HappyHorse media payloads and passes an authenticated smoke.

insert into public.v2_labs (lab_slug, name, country_code, description, status, routable)
values ('alibaba', 'Alibaba', 'CN', 'Alibaba model-development teams, including Taotian Group.', 'active', false)
on conflict (lab_slug) do update set
  name = excluded.name, country_code = excluded.country_code,
  description = excluded.description, status = excluded.status, updated_at = now();

insert into public.v2_models (
  model_slug, lab_slug, name, description, status, input_modalities,
  output_modalities, announced_at, released_at, metadata
)
values
  ('alibaba/happyhorse-1.0', 'alibaba', 'HappyHorse 1.0', 'Alibaba audio-video generation model with text, image, reference and editing modes.', 'active', array['text','image','video'], array['video','audio'], '2026-04-10T00:00:00Z', '2026-04-10T00:00:00Z', '{"max_resolution":"1080P","duration_seconds":[3,15],"fps":24,"source_url":"https://www.alibabacloud.com/help/en/model-studio/video-generate-edit-model"}'::jsonb),
  ('alibaba/happyhorse-1.1', 'alibaba', 'HappyHorse 1.1', 'Alibaba audio-video generation model with text, image and reference modes.', 'active', array['text','image'], array['video','audio'], '2026-06-23T00:00:00Z', '2026-06-23T00:00:00Z', '{"max_resolution":"1080P","duration_seconds":[3,15],"fps":24,"source_url":"https://www.alibabacloud.com/help/en/model-studio/video-generate-edit-model"}'::jsonb)
on conflict (model_slug) do update set
  name = excluded.name, description = excluded.description, status = excluded.status,
  input_modalities = excluded.input_modalities, output_modalities = excluded.output_modalities,
  announced_at = excluded.announced_at, released_at = excluded.released_at,
  metadata = excluded.metadata, updated_at = now();

insert into public.v2_model_provider_routes (
  provider_model_id, model_slug, provider_slug, provider_model_slug, status,
  routing_enabled, input_modalities, output_modalities, regions, effective_from, metadata
)
values
  ('alibaba-cloud:alibaba/happyhorse-1.0-t2v', 'alibaba/happyhorse-1.0', 'alibaba-cloud', 'happyhorse-1.0-t2v', 'active', false, array['text'], array['video','audio'], array['international','cn-mainland'], '2026-04-10T00:00:00Z', '{"mode":"text-to-video","gateway_note":"Awaiting HappyHorse adapter smoke test."}'::jsonb),
  ('alibaba-cloud:alibaba/happyhorse-1.0-i2v', 'alibaba/happyhorse-1.0', 'alibaba-cloud', 'happyhorse-1.0-i2v', 'active', false, array['text','image'], array['video','audio'], array['international','cn-mainland'], '2026-04-10T00:00:00Z', '{"mode":"image-to-video","gateway_note":"Wan mapper does not emit HappyHorse media arrays."}'::jsonb),
  ('alibaba-cloud:alibaba/happyhorse-1.0-r2v', 'alibaba/happyhorse-1.0', 'alibaba-cloud', 'happyhorse-1.0-r2v', 'active', false, array['text','image'], array['video','audio'], array['international','cn-mainland'], '2026-04-10T00:00:00Z', '{"mode":"reference-to-video","gateway_note":"Wan mapper does not emit HappyHorse media arrays."}'::jsonb),
  ('alibaba-cloud:alibaba/happyhorse-1.0-video-edit', 'alibaba/happyhorse-1.0', 'alibaba-cloud', 'happyhorse-1.0-video-edit', 'active', false, array['text','image','video'], array['video','audio'], array['international','cn-mainland'], '2026-04-10T00:00:00Z', '{"mode":"video-edit","gateway_note":"Phaseo video-edit surface is not implemented for Alibaba."}'::jsonb),
  ('alibaba-cloud:alibaba/happyhorse-1.1-t2v', 'alibaba/happyhorse-1.1', 'alibaba-cloud', 'happyhorse-1.1-t2v', 'active', false, array['text'], array['video','audio'], array['international','cn-mainland'], '2026-06-23T00:00:00Z', '{"mode":"text-to-video","gateway_note":"Awaiting HappyHorse adapter smoke test."}'::jsonb),
  ('alibaba-cloud:alibaba/happyhorse-1.1-i2v', 'alibaba/happyhorse-1.1', 'alibaba-cloud', 'happyhorse-1.1-i2v', 'active', false, array['text','image'], array['video','audio'], array['international','cn-mainland'], '2026-06-23T00:00:00Z', '{"mode":"image-to-video","gateway_note":"Wan mapper does not emit HappyHorse media arrays."}'::jsonb),
  ('alibaba-cloud:alibaba/happyhorse-1.1-r2v', 'alibaba/happyhorse-1.1', 'alibaba-cloud', 'happyhorse-1.1-r2v', 'active', false, array['text','image'], array['video','audio'], array['international','cn-mainland'], '2026-06-23T00:00:00Z', '{"mode":"reference-to-video","gateway_note":"Wan mapper does not emit HappyHorse media arrays."}'::jsonb)
on conflict (provider_model_id) do update set
  model_slug = excluded.model_slug, provider_slug = excluded.provider_slug,
  provider_model_slug = excluded.provider_model_slug, status = excluded.status,
  routing_enabled = excluded.routing_enabled, input_modalities = excluded.input_modalities,
  output_modalities = excluded.output_modalities, regions = excluded.regions,
  effective_from = excluded.effective_from, metadata = excluded.metadata, updated_at = now();

insert into public.v2_route_capabilities (
  provider_model_id, capability_id, status, params, effective_from, metadata
)
select provider_model_id, 'video.generate', 'active',
  '{"duration":{"type":"integer","min":3,"max":15},"resolution":{"type":"enum","values":["720P","1080P"]}}'::jsonb,
  effective_from, '{"gateway_status":"not_routable"}'::jsonb
from public.v2_model_provider_routes
where provider_model_id like 'alibaba-cloud:alibaba/happyhorse-%'
on conflict (provider_model_id, capability_id) do update set
  status = excluded.status, params = excluded.params,
  effective_from = excluded.effective_from, metadata = excluded.metadata, updated_at = now();
