-- Restrict only functions present in the environment being migrated. Some
-- historical deployments do not contain every optional worker or billing RPC.
do $migration$
declare
  signature text;
  target regprocedure;
  service_only_signatures text[] := array[
    'public.apply_workspace_usage_rollup_delta(timestamptz,uuid,uuid,text,text,bigint,bigint,bigint,bigint,numeric,bigint,numeric,bigint)',
    'public.calculate_tier_with_grace(uuid,bigint)',
    'public.calculate_workspace_previous_month_spend(uuid)',
    'public.claim_otel_export_outbox(integer)',
    'public.cleanup_dormant_enterprise_workspaces()',
    'public.gateway_deduct_and_check_top_up_once(uuid,text,bigint)',
    'public.gateway_fetch_request_context(uuid,text,text,uuid)',
    'public.gateway_fetch_request_context_with_reservations(uuid,text,text,uuid)',
    'public.gateway_wallet_capture_once(uuid,text,text)',
    'public.gateway_wallet_release_once(uuid,text,text)',
    'public.get_workspace_tier_info(uuid)',
    'public.increment_workspace_byok_monthly_request_count(uuid,timestamptz)',
    'public.provision_personal_workspace(uuid,text)',
    'public.publish_preset_version(uuid,uuid,text,text)',
    'public.refresh_gateway_activity_rollup_daily(uuid,timestamptz,timestamptz)',
    'public.refresh_gateway_model_usage_daily(timestamptz,timestamptz)',
    'public.refresh_gateway_usage_rollups(timestamptz)',
    'public.refresh_gateway_usage_rollups_workspace_scope(timestamptz)',
    'public.refresh_public_leaderboard_rollups(timestamptz,timestamptz)',
    'public.replace_subscription_plan_bundle(jsonb,jsonb,jsonb)',
    'public.stripe_apply_payment_intent_credit(uuid,text,text,bigint,timestamptz)',
    'public.stripe_claim_self_serve_refund(uuid,text,uuid)',
    'public.tg_system_settings_audit()',
    'public.update_workspace_tier(uuid)',
    'public.upsert_gateway_request_into_workspace_usage_rollup(uuid,timestamptz,uuid)',
    'public.wallet_apply_delta(uuid,bigint)'
  ];
  authenticated_signatures text[] := array[
    'public.approve_workspace_join_request(uuid)',
    'public.get_workspace_key_usage(uuid,timestamptz)',
    'public.monthly_spend_prev_cents(uuid)',
    'public.mtd_spend_cents(uuid)',
    'public.redeem_credit_code(text,uuid)',
    'public.reject_workspace_join_request(uuid)'
  ];
begin
  foreach signature in array service_only_signatures loop
    target := to_regprocedure(signature);
    if target is null then
      continue;
    end if;

    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      target
    );
    execute format('grant execute on function %s to service_role', target);
  end loop;

  foreach signature in array authenticated_signatures loop
    target := to_regprocedure(signature);
    if target is null then
      continue;
    end if;

    execute format(
      'revoke execute on function %s from public, anon',
      target
    );
    execute format(
      'grant execute on function %s to authenticated, service_role',
      target
    );
  end loop;
end
$migration$;
