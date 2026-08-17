begin;

create schema if not exists app;
create schema if not exists billing;
create schema if not exists catalog;
create schema if not exists content;
create schema if not exists gateway;
create schema if not exists internal;
create schema if not exists observability;

grant usage on schema auth, app, billing, catalog, content, gateway, internal, observability to public;

-- Better Auth. The imported Supabase identity table remains auth.users.
alter table public.account set schema auth;
alter table public.passkey set schema auth;
alter table public.session set schema auth;
alter table public."ssoProvider" set schema auth;
alter table public."twoFactor" set schema auth;
alter table public."user" set schema auth;
alter table public.verification set schema auth;

-- Application identity and workspace state.
alter table public.account_guardrail_settings set schema app;
alter table public.users set schema app;
alter table public.workspace_invites set schema app;
alter table public.workspace_join_requests set schema app;
alter table public.workspace_members set schema app;
alter table public.workspace_publisher_handle_aliases set schema app;
alter table public.workspace_settings set schema app;
alter table public.workspaces set schema app;

-- Billing, wallets, grants, and reservations.
alter table public.credit_grant_redemptions set schema billing;
alter table public.credit_grants set schema billing;
alter table public.credit_ledger set schema billing;
alter table if exists public.gateway_io_retention_billing_runs set schema billing;
alter table public.gateway_request_charges set schema billing;
alter table public.gateway_wallet_reservations set schema billing;
alter table public.v2_credit_ledger set schema billing;
alter table public.v2_credit_reservations set schema billing;
alter table public.wallets set schema billing;

-- Catalogue, model metadata, provider configuration, and pricing.
alter table public.model_discovery_hf_seen_models set schema catalog;
alter table public.model_discovery_issue_signals set schema catalog;
alter table public.model_discovery_runs set schema catalog;
alter table public.model_discovery_seen_models set schema catalog;
alter table public.v2_adapter_primitives set schema catalog;
alter table public.v2_benchmark_results set schema catalog;
alter table public.v2_benchmarks set schema catalog;
alter table public.v2_capability_adapters set schema catalog;
alter table public.v2_capability_constraints set schema catalog;
alter table public.v2_capability_evidence set schema catalog;
alter table public.v2_capability_parameters set schema catalog;
alter table public.v2_catalogue_admin_changes set schema catalog;
alter table public.v2_catalogue_backfill_issues set schema catalog;
alter table public.v2_catalogue_source_overrides set schema catalog;
alter table public.v2_execution_plans set schema catalog;
alter table public.v2_lab_links set schema catalog;
alter table public.v2_labs set schema catalog;
alter table public.v2_meter_definitions set schema catalog;
alter table public.v2_model_aliases set schema catalog;
alter table public.v2_model_details set schema catalog;
alter table public.v2_model_families set schema catalog;
alter table public.v2_model_links set schema catalog;
alter table public.v2_model_page_notices set schema catalog;
alter table public.v2_model_provider_routes set schema catalog;
alter table public.v2_models set schema catalog;
alter table public.v2_pricing_sku_meters set schema catalog;
alter table public.v2_pricing_skus set schema catalog;
alter table public.v2_provider_auth_profiles set schema catalog;
alter table public.v2_provider_capability_adapters set schema catalog;
alter table public.v2_provider_country_restrictions set schema catalog;
alter table public.v2_provider_endpoints set schema catalog;
alter table public.v2_provider_regions set schema catalog;
alter table public.v2_providers set schema catalog;
alter table public.v2_route_capabilities set schema catalog;
alter table public.v2_route_parameter_support set schema catalog;
alter table public.v2_route_variants set schema catalog;
alter table public.v2_service_tiers set schema catalog;
alter table public.v2_subscription_plan_features set schema catalog;
alter table public.v2_subscription_plan_models set schema catalog;
alter table public.v2_subscription_plans set schema catalog;

-- User-created and community content.
alter table public.catalogue_game_results set schema content;
alter table public.catalogue_interaction_puzzles set schema content;
alter table public.data_contribution_consent_events set schema content;
alter table public.data_contributions set schema content;
alter table public.gateway_feedback set schema content;
alter table public.preset_lineage set schema content;
alter table public.preset_versions set schema content;
alter table public.presets set schema content;

-- Gateway credentials, routing, OAuth, and execution configuration.
alter table public.api_apps set schema gateway;
alter table public.broadcast_destination_keys set schema gateway;
alter table public.broadcast_destination_rule_groups set schema gateway;
alter table public.broadcast_destination_rules set schema gateway;
alter table public.byok_keys set schema gateway;
alter table public.gateway_async_operations set schema gateway;
alter table public.gateway_async_webhook_deliveries set schema gateway;
alter table public.gateway_batch_file_uploads set schema gateway;
alter table public.gateway_batch_key_usage_records set schema gateway;
alter table public.gateway_batch_requests set schema gateway;
alter table public.gateway_dynamic_route_keys set schema gateway;
alter table public.gateway_dynamic_route_versions set schema gateway;
alter table public.gateway_dynamic_routes set schema gateway;
alter table public.gateway_preset_test_run_items set schema gateway;
alter table public.gateway_preset_test_runs set schema gateway;
alter table public.gateway_provider_health_states set schema gateway;
alter table public.gateway_realtime_sessions set schema gateway;
alter table public.gateway_webhook_endpoints set schema gateway;
alter table public.key_guardrails set schema gateway;
alter table public.keys set schema gateway;
alter table public.management_keys set schema gateway;
alter table public.oauth_app_metadata set schema gateway;
alter table public.oauth_authorization_codes set schema gateway;
alter table public.oauth_authorizations set schema gateway;
alter table public.oauth_clients set schema gateway;
alter table public.oauth_device_codes set schema gateway;
alter table public.oauth_refresh_tokens set schema gateway;
alter table public.security_key_reports set schema gateway;
alter table public.workspace_broadcast_destinations set schema gateway;
alter table public.workspace_byok_monthly_usage set schema gateway;
alter table public.workspace_classifiers set schema gateway;
alter table public.workspace_guardrails set schema gateway;
alter table public.workspace_member_guardrails set schema gateway;

-- Request telemetry, partitions, rollups, and derived request facts.
alter table public.gateway_requests set schema observability;
alter table public.gateway_requests_2026_03 set schema observability;
alter table public.gateway_requests_2026_04 set schema observability;
alter table public.gateway_requests_2026_05 set schema observability;
alter table public.gateway_requests_2026_06 set schema observability;
alter table public.gateway_requests_2026_07 set schema observability;
alter table public.gateway_requests_2026_08 set schema observability;
alter table public.gateway_requests_2026_09 set schema observability;
alter table public.gateway_requests_default set schema observability;
alter table public.gateway_upstream_requests set schema observability;
alter table public.gateway_upstream_requests_2026_07 set schema observability;
alter table public.gateway_upstream_requests_2026_08 set schema observability;
alter table public.gateway_upstream_requests_2026_09 set schema observability;
alter table public.gateway_upstream_requests_default set schema observability;
alter table public.gateway_io_logs set schema observability;
alter table public.gateway_observability_events set schema observability;
alter table public.gateway_provider_events set schema observability;
alter table public.public_model_task_daily set schema observability;
alter table public.public_model_user_usage_daily set schema observability;
alter table public.request_classification_daily set schema observability;
alter table public.request_classifications set schema observability;
alter table public.v2_private_usage_daily set schema observability;
alter table public.v2_private_usage_daily_meters set schema observability;
alter table public.v2_public_provider_health_daily set schema observability;
alter table public.v2_public_usage_daily set schema observability;
alter table public.v2_public_usage_daily_meters set schema observability;
alter table public.v2_public_usage_hourly set schema observability;
alter table public.v2_public_usage_hourly_meters set schema observability;
alter table public.v2_request_artifacts set schema observability;
alter table public.v2_request_attempts set schema observability;
alter table public.v2_request_facts set schema observability;
alter table public.v2_request_feedback set schema observability;
alter table public.v2_request_pricing_lines set schema observability;
alter table public.v2_request_routing_decisions set schema observability;
alter table public.v2_request_usage set schema observability;

-- Operational state that is not part of the product-facing data model.
alter table public.email_outbox set schema internal;
alter table public.monitor_history_commits set schema internal;
alter table public.monitor_history_events set schema internal;
alter table public.monitor_history_sync_state set schema internal;
alter table public.otel_export_outbox set schema internal;
alter table public.updates set schema internal;
alter table public.v2_analytics_outbox set schema internal;
alter table public.v2_control_plane_releases set schema internal;
alter table public.v2_rollup_refresh_state set schema internal;
alter table public.web_cache_generations set schema internal;
alter table public.web_cache_purge_events set schema internal;

-- Sequences do not move with their owning tables.
alter sequence public.v2_control_plane_releases_sequence_seq set schema internal;
alter sequence public.v2_request_routing_decisions_routing_decision_id_seq set schema observability;
alter sequence public.web_cache_purge_events_id_seq set schema internal;

-- Views retain their dependencies while gaining explicit domain ownership.
alter view public.oauth_apps_with_stats set schema gateway;
alter view public.v2_rpc_gateway_activity_rollup_daily set schema observability;
alter view public.v2_rpc_gateway_model_usage_daily set schema observability;
alter view public.v2_rpc_gateway_usage_rollup_daily_app set schema observability;
alter view public.v2_rpc_public_app_model_usage_daily set schema observability;
alter view public.v2_web_private_usage_daily set schema observability;
alter view public.v2_web_public_usage_daily set schema observability;
alter view public.v2_web_public_usage_hourly set schema observability;

commit;
