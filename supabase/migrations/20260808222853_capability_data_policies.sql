-- Capability policy is catalogue metadata, separate from the capability's
-- supported request-parameter payload (which may be either an object or array).
update public.v2_route_capabilities as capability
set metadata = jsonb_set(
  coalesce(capability.metadata, '{}'::jsonb),
  '{data_policy}',
  jsonb_build_object(
    'tier', 'logs',
    'confidence', 'confirmed',
    'zdrEligibility', 'ineligible',
    'retentionMode', 'until_deleted',
    'retentionDays', null,
    'reason', case
      when capability.capability_id = 'batch'
        then 'Batch processing persists request state and results.'
      else 'Provider file storage requires persistent state.'
    end,
    'evidenceUrl', case provider.provider_slug
      when 'openai' then 'https://platform.openai.com/docs/models/default-usage-policies-by-endpoint'
      when 'spacex-ai' then 'https://docs.x.ai/developers/faq/security'
      when 'x-ai' then 'https://docs.x.ai/developers/faq/security'
      when 'mistral' then 'https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr'
      else null
    end
  ),
  true
)
from public.v2_model_provider_routes as route
join public.v2_providers as provider
  on provider.provider_slug = route.provider_slug
where route.provider_model_id = capability.provider_model_id
  and capability.capability_id in ('batch', 'files.upload', 'files.list', 'files.retrieve')
  and provider.provider_slug in ('openai', 'spacex-ai', 'x-ai', 'mistral');
