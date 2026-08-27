update public.v2_service_tiers
set display_name = 'Fast', updated_at = now()
where service_tier_slug = 'priority';
