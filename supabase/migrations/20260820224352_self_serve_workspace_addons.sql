create table public.workspace_addon_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  addon_key text not null,
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  provider_price_id text,
  status text not null default 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  grace_until timestamptz,
  last_provider_event_created bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, addon_key),
  unique (provider, provider_subscription_id),
  check (addon_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  check (provider in ('stripe', 'manual')),
  check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'unpaid')),
  check (jsonb_typeof(metadata) = 'object')
);

create table public.workspace_addon_usage_monthly (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  addon_key text not null,
  metric_key text not null,
  period_start date not null,
  quantity bigint not null default 0,
  stripe_meter_event_id text,
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, addon_key, metric_key, period_start),
  check (addon_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  check (metric_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  check (quantity >= 0)
);

create table public.workspace_sso_monthly_active_users (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  period_start date not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (workspace_id, period_start, auth_user_id)
);

create index workspace_addon_subscriptions_workspace_status_idx
  on public.workspace_addon_subscriptions (workspace_id, status);
create index workspace_addon_usage_unreported_idx
  on public.workspace_addon_usage_monthly (period_start, addon_key)
  where reported_at is null;
create index workspace_sso_monthly_active_users_period_idx
  on public.workspace_sso_monthly_active_users (period_start, workspace_id);

insert into public.workspace_addon_subscriptions (
  workspace_id,
  addon_key,
  provider,
  status,
  metadata
)
select
  workspace_id,
  'identity',
  'manual',
  'active',
  jsonb_build_object('grandfathered', true, 'reason', 'existing_scim_configuration')
from public.scim_endpoints
where enabled
on conflict (workspace_id, addon_key) do nothing;

create or replace function public.sync_workspace_addon_subscription(
  p_workspace_id uuid,
  p_addon_key text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_provider_price_id text,
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
set search_path = ''
as $$
begin
  insert into public.workspace_addon_subscriptions (
    workspace_id,
    addon_key,
    provider,
    provider_customer_id,
    provider_subscription_id,
    provider_price_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    grace_until,
    last_provider_event_created,
    metadata,
    updated_at
  ) values (
    p_workspace_id,
    p_addon_key,
    'stripe',
    p_provider_customer_id,
    p_provider_subscription_id,
    p_provider_price_id,
    p_status,
    p_current_period_start,
    p_current_period_end,
    coalesce(p_cancel_at_period_end, false),
    p_grace_until,
    p_provider_event_created,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (workspace_id, addon_key) do update set
    provider = 'stripe',
    provider_customer_id = excluded.provider_customer_id,
    provider_subscription_id = excluded.provider_subscription_id,
    provider_price_id = excluded.provider_price_id,
    status = excluded.status,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    grace_until = excluded.grace_until,
    last_provider_event_created = excluded.last_provider_event_created,
    metadata = excluded.metadata,
    updated_at = now()
  where public.workspace_addon_subscriptions.last_provider_event_created <= excluded.last_provider_event_created;
end;
$$;

create or replace function public.record_workspace_sso_active_user(
  p_workspace_id uuid,
  p_auth_user_id uuid,
  p_seen_at timestamptz default now()
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_start date := date_trunc('month', p_seen_at at time zone 'UTC')::date;
  v_quantity bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_workspace_id::text || ':' || v_period_start::text, 0)
  );

  insert into public.workspace_sso_monthly_active_users (
    workspace_id,
    period_start,
    auth_user_id,
    first_seen_at,
    last_seen_at
  ) values (
    p_workspace_id,
    v_period_start,
    p_auth_user_id,
    p_seen_at,
    p_seen_at
  )
  on conflict (workspace_id, period_start, auth_user_id) do update set
    last_seen_at = greatest(
      public.workspace_sso_monthly_active_users.last_seen_at,
      excluded.last_seen_at
    );

  select count(*)
    into v_quantity
  from public.workspace_sso_monthly_active_users
  where workspace_id = p_workspace_id
    and period_start = v_period_start;

  insert into public.workspace_addon_usage_monthly (
    workspace_id,
    addon_key,
    metric_key,
    period_start,
    quantity,
    updated_at
  ) values (
    p_workspace_id,
    'identity',
    'sso_mau',
    v_period_start,
    v_quantity,
    now()
  )
  on conflict (workspace_id, addon_key, metric_key, period_start) do update set
    quantity = excluded.quantity,
    updated_at = now();

  return v_quantity;
end;
$$;

alter table public.workspace_addon_subscriptions enable row level security;
alter table public.workspace_addon_usage_monthly enable row level security;
alter table public.workspace_sso_monthly_active_users enable row level security;

revoke all on public.workspace_addon_subscriptions from anon, authenticated;
revoke all on public.workspace_addon_usage_monthly from anon, authenticated;
revoke all on public.workspace_sso_monthly_active_users from anon, authenticated;

grant select, insert, update, delete on public.workspace_addon_subscriptions to service_role;
grant select, insert, update, delete on public.workspace_addon_usage_monthly to service_role;
grant select, insert, update, delete on public.workspace_sso_monthly_active_users to service_role;

revoke all on function public.sync_workspace_addon_subscription(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.sync_workspace_addon_subscription(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz,bigint,jsonb) to service_role;
revoke all on function public.record_workspace_sso_active_user(uuid,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.record_workspace_sso_active_user(uuid,uuid,timestamptz) to service_role;
