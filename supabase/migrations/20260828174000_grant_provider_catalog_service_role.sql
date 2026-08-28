-- The provider catalog workers use the service role through PostgREST. RLS
-- bypass does not imply relation privileges, so grant only the CRUD operations
-- required by the onboarding, synchronization, and review pipeline.

grant select, insert, update, delete on table
  public.provider_onboarding_submissions,
  public.provider_account_links,
  public.provider_catalog_sources,
  public.provider_catalog_sync_runs,
  public.provider_catalog_sync_models,
  public.provider_catalog_sync_model_capabilities,
  public.provider_catalog_models,
  public.provider_catalog_model_capabilities,
  public.provider_catalog_events,
  public.provider_catalog_route_candidates,
  public.provider_claim_challenges
to service_role;

-- Review decisions are an append-only audit trail.
grant select, insert on table public.provider_catalog_review_events to service_role;
