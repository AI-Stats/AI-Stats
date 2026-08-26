-- Add provider offer identity to the currently installed pricing RPC without
-- replacing later fixes such as included quantities and authored priorities.
do $migration$
declare
  definition text;
  patched text;
begin
  select pg_get_functiondef(
    'public.get_v2_model_pricing(text,text,text)'::regprocedure
  ) into definition;

  definition := replace(definition, chr(13) || chr(10), chr(10));
  if position('provider.offer_label' in definition) > 0 then
    return;
  end if;

  patched := replace(
    definition,
    '      provider.name as provider_name,' || chr(10) ||
    '      provider.status as provider_status,',
    '      provider.name as provider_name,' || chr(10) ||
    '      provider.provider_family_slug,' || chr(10) ||
    '      provider.offer_label,' || chr(10) ||
    '      provider.offer_scope,' || chr(10) ||
    '      provider.country_code,' || chr(10) ||
    '      provider.default_execution_regions,' || chr(10) ||
    '      provider.default_data_regions,' || chr(10) ||
    '      provider.status as provider_status,'
  );
  patched := replace(
    patched,
    '      max(model.provider_name) as provider_name,' || chr(10) ||
    '      max(model.provider_status) as provider_status,',
    '      max(model.provider_name) as provider_name,' || chr(10) ||
    '      max(model.provider_family_slug) as provider_family_slug,' || chr(10) ||
    '      max(model.offer_label) as offer_label,' || chr(10) ||
    '      max(model.offer_scope) as offer_scope,' || chr(10) ||
    '      max(model.country_code) as country_code,' || chr(10) ||
    '      max(model.default_execution_regions) as default_execution_regions,' || chr(10) ||
    '      max(model.default_data_regions) as default_data_regions,' || chr(10) ||
    '      max(model.provider_status) as provider_status,'
  );
  patched := replace(
    patched,
    '      ''api_provider_name'', grouped.provider_name,' || chr(10) ||
    '      ''status'', grouped.provider_status,',
    '      ''api_provider_name'', grouped.provider_name,' || chr(10) ||
    '      ''provider_family_id'', grouped.provider_family_slug,' || chr(10) ||
    '      ''offer_label'', grouped.offer_label,' || chr(10) ||
    '      ''offer_scope'', grouped.offer_scope,' || chr(10) ||
    '      ''country_code'', grouped.country_code,' || chr(10) ||
    '      ''default_execution_regions'', grouped.default_execution_regions,' || chr(10) ||
    '      ''default_data_regions'', grouped.default_data_regions,' || chr(10) ||
    '      ''status'', grouped.provider_status,'
  );

  if patched = definition
     or position('provider.offer_label' in patched) = 0
     or position('''priority'', coalesce(' in patched) = 0
     or position('''included_quantity'', coalesce(' in patched) = 0 then
    raise exception 'get_v2_model_pricing has an unexpected definition';
  end if;

  execute patched;
end
$migration$;

notify pgrst, 'reload schema';
