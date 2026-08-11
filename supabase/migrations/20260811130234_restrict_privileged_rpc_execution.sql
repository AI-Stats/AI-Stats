-- These privileged functions are called only from service-role application
-- paths, scheduled jobs, webhooks, or other owner-executed database functions.
revoke execute on function public.apply_workspace_usage_rollup_delta(timestamptz, uuid, uuid, text, text, bigint, bigint, bigint, bigint, numeric, bigint, numeric, bigint) from public, anon, authenticated;
revoke execute on function public.calculate_tier_with_grace(uuid, bigint) from public, anon, authenticated;
revoke execute on function public.calculate_workspace_previous_month_spend(uuid) from public, anon, authenticated;
revoke execute on function public.claim_otel_export_outbox(integer) from public, anon, authenticated;
revoke execute on function public.cleanup_dormant_enterprise_workspaces() from public, anon, authenticated;
revoke execute on function public.gateway_deduct_and_check_top_up_once(uuid, text, bigint) from public, anon, authenticated;
revoke execute on function public.gateway_fetch_request_context(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.gateway_fetch_request_context_with_reservations(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.gateway_wallet_capture_once(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.gateway_wallet_release_once(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.get_workspace_tier_info(uuid) from public, anon, authenticated;
revoke execute on function public.increment_workspace_byok_monthly_request_count(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.provision_personal_workspace(uuid, text) from public, anon, authenticated;
revoke execute on function public.publish_preset_version(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.refresh_gateway_activity_rollup_daily(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.refresh_gateway_model_usage_daily(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.refresh_gateway_usage_rollups(timestamptz) from public, anon, authenticated;
revoke execute on function public.refresh_gateway_usage_rollups_workspace_scope(timestamptz) from public, anon, authenticated;
revoke execute on function public.refresh_public_leaderboard_rollups(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.replace_subscription_plan_bundle(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.stripe_apply_payment_intent_credit(uuid, text, text, bigint, timestamptz) from public, anon, authenticated;
revoke execute on function public.stripe_claim_self_serve_refund(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.tg_system_settings_audit() from public, anon, authenticated;
revoke execute on function public.update_workspace_tier(uuid) from public, anon, authenticated;
revoke execute on function public.upsert_gateway_request_into_workspace_usage_rollup(uuid, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.wallet_apply_delta(uuid, bigint) from public, anon, authenticated;

grant execute on function public.apply_workspace_usage_rollup_delta(timestamptz, uuid, uuid, text, text, bigint, bigint, bigint, bigint, numeric, bigint, numeric, bigint) to service_role;
grant execute on function public.calculate_tier_with_grace(uuid, bigint) to service_role;
grant execute on function public.calculate_workspace_previous_month_spend(uuid) to service_role;
grant execute on function public.claim_otel_export_outbox(integer) to service_role;
grant execute on function public.cleanup_dormant_enterprise_workspaces() to service_role;
grant execute on function public.gateway_deduct_and_check_top_up_once(uuid, text, bigint) to service_role;
grant execute on function public.gateway_fetch_request_context(uuid, text, text, uuid) to service_role;
grant execute on function public.gateway_fetch_request_context_with_reservations(uuid, text, text, uuid) to service_role;
grant execute on function public.gateway_wallet_capture_once(uuid, text, text) to service_role;
grant execute on function public.gateway_wallet_release_once(uuid, text, text) to service_role;
grant execute on function public.get_workspace_tier_info(uuid) to service_role;
grant execute on function public.increment_workspace_byok_monthly_request_count(uuid, timestamptz) to service_role;
grant execute on function public.provision_personal_workspace(uuid, text) to service_role;
grant execute on function public.publish_preset_version(uuid, uuid, text, text) to service_role;
grant execute on function public.refresh_gateway_activity_rollup_daily(uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.refresh_gateway_model_usage_daily(timestamptz, timestamptz) to service_role;
grant execute on function public.refresh_gateway_usage_rollups(timestamptz) to service_role;
grant execute on function public.refresh_gateway_usage_rollups_workspace_scope(timestamptz) to service_role;
grant execute on function public.refresh_public_leaderboard_rollups(timestamptz, timestamptz) to service_role;
grant execute on function public.replace_subscription_plan_bundle(jsonb, jsonb, jsonb) to service_role;
grant execute on function public.stripe_apply_payment_intent_credit(uuid, text, text, bigint, timestamptz) to service_role;
grant execute on function public.stripe_claim_self_serve_refund(uuid, text, uuid) to service_role;
grant execute on function public.tg_system_settings_audit() to service_role;
grant execute on function public.update_workspace_tier(uuid) to service_role;
grant execute on function public.upsert_gateway_request_into_workspace_usage_rollup(uuid, timestamptz, uuid) to service_role;
grant execute on function public.wallet_apply_delta(uuid, bigint) to service_role;

-- These RPCs are user-facing, but only for signed-in users. Their bodies
-- enforce workspace ownership, membership, or administrative authorization.
revoke execute on function public.approve_workspace_join_request(uuid) from public, anon;
revoke execute on function public.get_workspace_key_usage(uuid, timestamptz) from public, anon;
revoke execute on function public.monthly_spend_prev_cents(uuid) from public, anon;
revoke execute on function public.mtd_spend_cents(uuid) from public, anon;
revoke execute on function public.redeem_credit_code(text, uuid) from public, anon;
revoke execute on function public.reject_workspace_join_request(uuid) from public, anon;

grant execute on function public.approve_workspace_join_request(uuid) to authenticated, service_role;
grant execute on function public.get_workspace_key_usage(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.monthly_spend_prev_cents(uuid) to authenticated, service_role;
grant execute on function public.mtd_spend_cents(uuid) to authenticated, service_role;
grant execute on function public.redeem_credit_code(text, uuid) to authenticated, service_role;
grant execute on function public.reject_workspace_join_request(uuid) to authenticated, service_role;
