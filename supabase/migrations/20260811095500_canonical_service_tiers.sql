-- Keep historical tier rows for pricing foreign keys, but expose only the
-- canonical service-tier vocabulary for new catalogue writes.
insert into public.v2_service_tiers (service_tier_slug, display_name, status, metadata)
values
  ('standard', 'Standard', 'active', jsonb_build_object('source', 'v2_canonical')),
  ('priority', 'Priority', 'active', jsonb_build_object('source', 'v2_canonical')),
  ('batch', 'Batch', 'active', jsonb_build_object('source', 'v2_canonical')),
  ('flex', 'Flex', 'active', jsonb_build_object('source', 'v2_canonical'))
on conflict (service_tier_slug) do update set
  display_name = excluded.display_name,
  status = excluded.status,
  metadata = public.v2_service_tiers.metadata || excluded.metadata,
  updated_at = now();

update public.v2_service_tiers
set status = 'disabled', updated_at = now()
where service_tier_slug in ('contributor', 'enterprise', 'free');
