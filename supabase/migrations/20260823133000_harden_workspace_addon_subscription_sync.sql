create or replace function public.sync_workspace_addon_subscription(
  p_workspace_id uuid,
  p_addon_key text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_provider_price_id text,
  p_quote_id uuid,
  p_plan_key text,
  p_pricing_version text,
  p_included_members integer,
  p_fee_policy text,
  p_included_card_top_up_nanos bigint,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_grace_until timestamptz,
  p_provider_event_created bigint,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_addon_subscriptions (
    workspace_id, addon_key, provider, provider_customer_id,
    provider_subscription_id, provider_price_id, quote_id, plan_key,
    pricing_version, included_members, fee_policy,
    included_card_top_up_nanos, status, current_period_start,
    current_period_end, cancel_at_period_end, grace_until,
    last_provider_event_created, metadata, updated_at
  ) values (
    p_workspace_id, p_addon_key, 'stripe', p_provider_customer_id,
    p_provider_subscription_id, p_provider_price_id, p_quote_id, p_plan_key,
    p_pricing_version, p_included_members, p_fee_policy,
    coalesce(p_included_card_top_up_nanos, 0), p_status, p_current_period_start,
    p_current_period_end, coalesce(p_cancel_at_period_end, false), p_grace_until,
    coalesce(p_provider_event_created, 0), coalesce(p_metadata, '{}'::jsonb), now()
  )
  on conflict (workspace_id, addon_key) do update set
    provider = 'stripe',
    provider_customer_id = excluded.provider_customer_id,
    provider_subscription_id = excluded.provider_subscription_id,
    provider_price_id = excluded.provider_price_id,
    quote_id = excluded.quote_id,
    plan_key = excluded.plan_key,
    pricing_version = excluded.pricing_version,
    included_members = excluded.included_members,
    fee_policy = excluded.fee_policy,
    included_card_top_up_nanos = excluded.included_card_top_up_nanos,
    status = excluded.status,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    grace_until = case
      when public.workspace_addon_subscriptions.status = 'past_due'
        and excluded.status = 'past_due'
      then public.workspace_addon_subscriptions.grace_until
      else excluded.grace_until
    end,
    last_provider_event_created = excluded.last_provider_event_created,
    metadata = public.workspace_addon_subscriptions.metadata || excluded.metadata,
    updated_at = now()
  where public.workspace_addon_subscriptions.last_provider_event_created <= excluded.last_provider_event_created;
end;
$$;

revoke all on function public.sync_workspace_addon_subscription(uuid,text,text,text,text,uuid,text,text,integer,text,bigint,text,timestamptz,timestamptz,boolean,timestamptz,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.sync_workspace_addon_subscription(uuid,text,text,text,text,uuid,text,text,integer,text,bigint,text,timestamptz,timestamptz,boolean,timestamptz,bigint,jsonb) to service_role;
