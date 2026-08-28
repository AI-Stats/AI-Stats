-- Correct deployments that received the broader provider pipeline grant before
-- provider_catalog_review_events was split out as an append-only audit table.

revoke update, delete on table public.provider_catalog_review_events from service_role;
grant select, insert on table public.provider_catalog_review_events to service_role;
