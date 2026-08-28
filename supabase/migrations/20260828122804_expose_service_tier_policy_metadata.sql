-- Persist service-tier policy overrides in provider metadata so a provider can
-- describe a normal offer separately from stateful tiers such as Batch.
update public.v2_providers
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'service_tier_data_policies',
  coalesce(metadata->'service_tier_data_policies', '{}'::jsonb) || jsonb_build_object(
    'batch', jsonb_build_object(
      'tier', 'logs',
      'confidence', 'confirmed',
      'zdrEligibility', 'ineligible',
      'retentionMode', 'until_deleted',
      'retentionDays', null,
      'reason', 'Mistral explicitly excludes batch processing and files from ZDR because they are stateful.',
      'evidenceUrl', 'https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr'
    )
  )
), updated_at = now()
where provider_slug = 'mistral';

-- Expose the provider service-tier policy map through the non-stealth pricing
-- projection. The public wrapper redacts the same field for stealth routes.
do $migration$
declare
  definition text;
  patched text;
begin
  select pg_get_functiondef(
    'public.get_v2_model_pricing_without_stealth_redaction(text,text,text)'::regprocedure
  ) into definition;

  definition := replace(definition, chr(13) || chr(10), chr(10));
  if position('service_tier_data_policies' in definition) = 0 then
    patched := replace(
      definition,
      chr(39) || 'privacy_policy_url' || chr(39) || ', policy.metadata->>' ||
        chr(39) || 'privacy_policy_url' || chr(39) || ',' || chr(10),
      chr(39) || 'privacy_policy_url' || chr(39) || ', policy.metadata->>' ||
        chr(39) || 'privacy_policy_url' || chr(39) || ',' || chr(10) ||
      '      ' || chr(39) || 'service_tier_data_policies' || chr(39) ||
        ', coalesce(policy.metadata->' || chr(39) || 'service_tier_data_policies' ||
        chr(39) || ', ' || chr(39) || '{}' || chr(39) || '::jsonb),' || chr(10)
    );

    if patched = definition or position('''service_tier_data_policies''' in patched) = 0 then
      raise exception 'get_v2_model_pricing_without_stealth_redaction has an unexpected definition';
    end if;
    execute patched;
  end if;
end
$migration$;

do $migration$
declare
  definition text;
  patched text;
begin
  select pg_get_functiondef(
    'public.get_v2_model_pricing(text,text,text)'::regprocedure
  ) into definition;

  definition := replace(definition, chr(13) || chr(10), chr(10));
  if position('''service_tier_data_policies'', null' in definition) = 0 then
    patched := replace(
      definition,
      '        ''data_policy_contract_notes'', null,' || chr(10),
      '        ''data_policy_contract_notes'', null,' || chr(10) ||
      '        ''service_tier_data_policies'', null,' || chr(10)
    );

    if patched = definition or position('''service_tier_data_policies'', null' in patched) = 0 then
      raise exception 'get_v2_model_pricing has an unexpected definition';
    end if;
    execute patched;
  end if;
end
$migration$;

notify pgrst, 'reload schema';
