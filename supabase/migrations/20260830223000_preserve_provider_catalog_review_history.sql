-- Review decisions are an append-only audit trail. Revoking DELETE on the
-- child table alone does not prevent a parent-row cascade.

alter table public.provider_catalog_review_events
  drop constraint if exists provider_catalog_review_events_run_id_fkey;

alter table public.provider_catalog_review_events
  add constraint provider_catalog_review_events_run_id_fkey
  foreign key (run_id)
  references public.provider_catalog_sync_runs(id)
  on delete restrict
  not valid;

revoke delete on table public.provider_catalog_sync_runs from service_role;
revoke update, delete on table public.provider_catalog_review_events from service_role;
grant select, insert on table public.provider_catalog_review_events to service_role;
