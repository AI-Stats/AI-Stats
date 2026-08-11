update public.v2_providers
set country_code = 'PL',
    updated_at = now()
where provider_slug = 'aion-labs'
  and country_code is distinct from 'PL';
