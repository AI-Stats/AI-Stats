-- Prepare announced upcoming video models. Hailuo 3 is intentionally omitted because it is not released or officially documented.
-- release scheduling is not proof of a routable inference endpoint.

insert into public.v2_models (
  model_slug, lab_slug, name, description, status, hidden, input_modalities,
  output_modalities, announced_at, released_at, metadata
)
values
  ('black-forest-labs/flux-3', 'black-forest-labs', 'FLUX 3', 'Black Forest Labs announced next-generation model; final specifications and modalities remain unconfirmed.', 'draft', false, array['text','image'], array['video'], '2026-07-28T00:00:00Z', '2026-08-04T00:00:00Z', '{"release_status":"scheduled","gateway_status":"not_routable","schedule_source":"maintainer-supplied advance release schedule","modality_status":"unconfirmed"}'::jsonb),
  ('qwen/wan3', 'qwen', 'Wan 3', 'Announced next generation of the Wan video-model family.', 'draft', false, array['text','image'], array['video'], '2026-07-28T00:00:00Z', '2026-08-06T00:00:00Z', '{"release_status":"scheduled","gateway_status":"not_routable","schedule_source":"maintainer-supplied advance release schedule"}'::jsonb),
  ('bytedance/seedance-2.5', 'bytedance', 'Seedance 2.5', 'ByteDance announced next-generation video model; revised launch timing awaits final approval.', 'draft', false, array['text','image','video','audio'], array['video','audio'], '2026-06-23T00:00:00Z', null, '{"release_status":"approval_pending","gateway_status":"not_routable","schedule_source":"maintainer-supplied update"}'::jsonb)
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
