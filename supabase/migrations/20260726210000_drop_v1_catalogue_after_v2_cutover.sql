-- Final destructive catalogue cutover.
--
-- Release ordering matters: deploy the V2-only application/importer first,
-- verify it in production, then apply this migration. The assertion prevents
-- the table removal if parity, pricing, request mirroring, or external database
-- dependencies have regressed.

drop function if exists public.sync_data_api_provider_models_model_id() cascade;

select public.assert_v2_catalogue_cutover_ready();

drop table public.data_api_model_page_notices;
drop table public.data_api_model_aliases;
drop table public.data_api_pricing_rules;
drop table public.data_api_pricing_skus;
drop table public.data_api_provider_model_capabilities;
drop table public.data_benchmark_results;
drop table public.data_model_details;
drop table public.data_model_links;
drop table public.data_subscription_plan_features;
drop table public.data_subscription_plan_models;
drop table public.data_api_provider_models;
drop table public.data_subscription_plans;
drop table public.data_benchmarks;
drop table public.data_models;
drop table public.data_model_families;
drop table public.data_organisation_links;
drop table public.data_api_providers;
drop table public.data_organisations;

comment on table public.v2_models is
  'Authoritative model catalogue. Repository JSON is the sole authoring source.';
comment on table public.gateway_requests is
  'Authoritative partitioned gateway request log. V2 observability tables extend this record; they do not replace it.';

drop function public.assert_v2_catalogue_cutover_ready();
drop function public.get_v2_catalogue_cutover_preflight();
