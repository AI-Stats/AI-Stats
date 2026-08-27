-- Make Data API exposure opt-in for objects created by the application owner.
-- Existing grants are unchanged; each future API object must grant access explicitly.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;

-- These checks were introduced as NOT VALID to avoid blocking their original rollout.
-- A preflight scan found no violating rows, so make their historical-data guarantee explicit.
alter table public.gateway_requests
  validate constraint gateway_requests_performance_metrics_nonnegative;

alter table public.v2_request_facts
  validate constraint v2_request_facts_performance_metrics_nonnegative;
