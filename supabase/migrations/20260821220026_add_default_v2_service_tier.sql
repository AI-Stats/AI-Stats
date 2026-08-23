-- Preserve the legacy "default" route tier so route variant imports satisfy
-- the v2_route_variants.service_tier_slug foreign key. It is not a selectable
-- canonical pricing tier, so leave it disabled for new catalogue writes.
insert into public.v2_service_tiers (service_tier_slug, display_name, status, metadata)
values (
  'default',
  'Default',
  'disabled',
  jsonb_build_object('source', 'v2_legacy_route_tier')
)
on conflict (service_tier_slug) do update set
  display_name = excluded.display_name,
  status = excluded.status,
  metadata = public.v2_service_tiers.metadata || excluded.metadata,
  updated_at = now();
