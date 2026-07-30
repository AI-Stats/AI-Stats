-- Record rumoured next-generation video models without asserting release dates.
-- No provider route is inserted: none has an officially verified inference endpoint.

insert into public.v2_models (
  model_slug, lab_slug, name, description, status, hidden, input_modalities,
  output_modalities, announced_at, released_at, metadata
)
values
  ('minimax/hailuo-3', 'minimax', 'Hailuo 3', 'Rumoured next-generation MiniMax video model; no official announcement or specifications have been verified.', 'draft', false, array['text','image'], array['video'], '2026-07-28T00:00:00Z', null, '{"release_status":"rumoured","gateway_status":"not_routable","evidence_status":"maintainer-supplied rumour"}'::jsonb),
  ('black-forest-labs/flux-3', 'black-forest-labs', 'FLUX 3', 'Rumoured next-generation Black Forest Labs video model; final specifications and modalities remain unconfirmed.', 'draft', false, array['text','image'], array['video'], '2026-07-28T00:00:00Z', null, '{"release_status":"rumoured","gateway_status":"not_routable","evidence_status":"maintainer-supplied rumour","modality_status":"unconfirmed"}'::jsonb),
  ('qwen/wan3', 'qwen', 'Wan 3', 'Rumoured next generation of the Wan video-model family.', 'draft', false, array['text','image'], array['video'], '2026-07-28T00:00:00Z', null, '{"release_status":"rumoured","gateway_status":"not_routable","evidence_status":"maintainer-supplied rumour"}'::jsonb),
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
