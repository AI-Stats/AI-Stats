-- Tinker is the product/API name for Thinking Machines' primary provider,
-- rather than a specialised sibling offer within the provider family.
update public.v2_providers
set
  provider_family_slug = 'thinking-machines',
  offer_label = null,
  offer_scope = 'global'
where provider_slug = 'thinking-machines';
