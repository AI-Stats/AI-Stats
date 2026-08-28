-- Carry route-capability policy metadata through the public model-pricing
-- projection. The capability metadata already stores tier-specific policy
-- facts (for example, Batch retention), but the RPC previously discarded it.

-- Mistral's ZDR approval applies to its supported stateless APIs. Keep this
-- capability-scoped so stateful Batch/files routes can explicitly override it,
-- and do not apply the stateless default to Mistral Labs model slugs.
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
  and capability.capability_id in (
    'text.generate',
    'text.embed',
    'text.moderate',
    'text.classify',
    'ocr',
    'audio.speech',
    'audio.transcribe'
  )
  and not (coalesce(capability.metadata, '{}'::jsonb) ? 'data_policy');

do $migration$
declare
  definition text;
  patched text;
begin
  select pg_get_functiondef(
    'public.get_v2_model_pricing_without_stealth_redaction(text,text,text)'::regprocedure
  ) into definition;

  definition := replace(definition, chr(13) || chr(10), chr(10));
  if position('capability.metadata->''data_policy'' as data_policy' in definition) > 0 then
    return;
  end if;

  patched := replace(
    definition,
    '      capability.params,' || chr(10) ||
    '      capability.max_input_tokens,',
    '      capability.params,' || chr(10) ||
    '      capability.metadata->''data_policy'' as data_policy,' || chr(10) ||
    '      capability.max_input_tokens,'
  );
  patched := replace(
    patched,
    '        ''params'', model.params,' || chr(10) ||
    '        ''service_tier'', model.service_tier_slug,',
    '        ''params'', model.params,' || chr(10) ||
    '        ''data_policy'', coalesce(model.data_policy, ''{}''::jsonb),' || chr(10) ||
    '        ''service_tier'', model.service_tier_slug,'
  );

  if patched = definition
     or position('capability.metadata->''data_policy'' as data_policy' in patched) = 0
     or position('''data_policy'', coalesce(model.data_policy' in patched) = 0 then
    raise exception 'get_v2_model_pricing_without_stealth_redaction has an unexpected definition';
  end if;

  execute patched;
end
$migration$;

-- The public pricing wrapper redacts provider policy for stealth routes. Keep
-- the newly projected capability policy redacted there as well.
do $migration$
declare
  definition text;
  patched text;
begin
  select pg_get_functiondef(
    'public.get_v2_model_pricing(text,text,text)'::regprocedure
  ) into definition;

  definition := replace(definition, chr(13) || chr(10), chr(10));
  if position('''data_policy'', ''{}''::jsonb' in definition) > 0 then
    return;
  end if;

  patched := replace(
    definition,
    '            ''data_region'', null' || chr(10) ||
    '          )',
    '            ''data_region'', null,' || chr(10) ||
    '            ''data_policy'', ''{}''::jsonb' || chr(10) ||
    '          )'
  );

  if patched = definition
     or position('''data_policy'', ''{}''::jsonb' in patched) = 0 then
    raise exception 'get_v2_model_pricing has an unexpected definition';
  end if;

  execute patched;
end
$migration$;

notify pgrst, 'reload schema';
