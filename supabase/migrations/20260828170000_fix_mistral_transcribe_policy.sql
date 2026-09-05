-- The route capability identifier is audio.transcribe. The earlier policy
-- backfill used audio.transcription, so transcription routes were left
-- without the provider's capability-level policy metadata.
update public.v2_route_capabilities as capability
set metadata = jsonb_set(
  coalesce(capability.metadata, '{}'::jsonb),
  '{data_policy}',
  jsonb_build_object(
    'tier', 'private',
    'confidence', 'confirmed',
    'zdrEligibility', 'eligible',
    'retentionMode', 'transient',
    'retentionDays', 0,
    'reason', 'Mistral confirmed that, with ZDR enabled, stateless API inputs and outputs are not stored or logged longer than strictly necessary to generate the output.',
    'evidenceUrl', 'https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr'
  ),
  true
)
from public.v2_model_provider_routes as route
where route.provider_model_id = capability.provider_model_id
  and route.provider_slug = 'mistral'
  and coalesce(route.provider_model_slug, '') not like 'labs-%'
  and capability.capability_id = 'audio.transcribe'
  and not (coalesce(capability.metadata, '{}'::jsonb) ? 'data_policy');

