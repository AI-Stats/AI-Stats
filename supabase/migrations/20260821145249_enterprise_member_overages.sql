drop trigger if exists workspace_enterprise_member_limit_guard on public.workspace_members;
drop function if exists private.enforce_workspace_enterprise_member_limit();

alter table public.workspace_enterprise_quotes
  drop constraint if exists workspace_enterprise_quotes_member_count_check;
alter table public.workspace_enterprise_quotes
  add constraint workspace_enterprise_quotes_member_count_check
  check (member_count between 1 and 2147483647);

alter table public.workspace_addon_usage_monthly
  add column reported_quantity bigint not null default 0,
  add constraint workspace_addon_usage_reported_quantity_check
    check (reported_quantity >= 0 and reported_quantity <= quantity);

create or replace function private.enforce_workspace_enterprise_member_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_limit integer;
  v_member_count bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('enterprise-member-limit:' || new.workspace_id::text, 0)
  );

  if exists (
    select 1 from public.workspace_members member
    where member.workspace_id = new.workspace_id and member.user_id = new.user_id
  ) then return new; end if;

  select subscription.included_members into v_member_limit
  from public.workspace_addon_subscriptions subscription
  where subscription.workspace_id = new.workspace_id
    and subscription.addon_key = 'identity'
    and subscription.included_members < 100000
    and (
      subscription.status in ('active', 'trialing')
      or (subscription.status = 'past_due' and subscription.grace_until > pg_catalog.now())
    );

  if v_member_limit is null then return new; end if;

  select pg_catalog.count(*) into v_member_count
  from public.workspace_members member where member.workspace_id = new.workspace_id;

  if v_member_count >= v_member_limit then
    raise exception using errcode = '23514', message = 'workspace_enterprise_member_limit_reached';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_workspace_enterprise_member_capacity() from public, anon, authenticated;

create trigger workspace_enterprise_member_limit_guard
before insert on public.workspace_members
for each row execute function private.enforce_workspace_enterprise_member_capacity();

create table public.workspace_enterprise_member_overages (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  period_start date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  primary key (workspace_id, period_start, user_id)
);

create index workspace_enterprise_member_overages_period_idx
  on public.workspace_enterprise_member_overages (period_start, workspace_id);

alter table public.workspace_enterprise_member_overages enable row level security;
revoke all on public.workspace_enterprise_member_overages from public, anon, authenticated;
grant select, insert, update, delete on public.workspace_enterprise_member_overages to service_role;

create or replace function public.refresh_workspace_enterprise_member_overage(p_workspace_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_start date;
  v_included_members integer;
  v_monthly_unique_members bigint;
  v_overage_count bigint;
begin
  select subscription.included_members,
         coalesce(subscription.current_period_start::date, pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'UTC')::date)
  into v_included_members, v_period_start
  from public.workspace_addon_subscriptions subscription
  where subscription.workspace_id = p_workspace_id
    and subscription.addon_key = 'identity'
    and subscription.included_members >= 100000
    and (
      subscription.status in ('active', 'trialing')
      or (subscription.status = 'past_due' and subscription.grace_until > pg_catalog.now())
    );

  if v_included_members is null then return 0; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('enterprise-member-overage:' || p_workspace_id::text || ':' || v_period_start::text, 0)
  );

  insert into public.workspace_enterprise_member_overages (workspace_id, period_start, user_id)
  select member.workspace_id, v_period_start, member.user_id
  from public.workspace_members member
  where member.workspace_id = p_workspace_id
  on conflict do nothing;

  select pg_catalog.count(*) into v_monthly_unique_members
  from public.workspace_enterprise_member_overages usage
  where usage.workspace_id = p_workspace_id and usage.period_start = v_period_start;

  v_overage_count := greatest(v_monthly_unique_members - v_included_members, 0);

  insert into public.workspace_addon_usage_monthly as usage_monthly (
    workspace_id, addon_key, metric_key, period_start, quantity, updated_at
  ) values (
    p_workspace_id, 'identity', 'member_overage', v_period_start, v_overage_count, pg_catalog.now()
  ) on conflict (workspace_id, addon_key, metric_key, period_start) do update set
    quantity = greatest(usage_monthly.quantity, excluded.quantity),
    updated_at = excluded.updated_at;

  return v_overage_count;
end;
$$;

revoke all on function public.refresh_workspace_enterprise_member_overage(uuid) from public, anon, authenticated;
grant execute on function public.refresh_workspace_enterprise_member_overage(uuid) to service_role;

create or replace function private.record_workspace_enterprise_member_overage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_start date;
  v_included_members integer;
  v_monthly_unique_members bigint;
  v_overage_count bigint;
begin
  select subscription.included_members,
         coalesce(subscription.current_period_start::date, pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'UTC')::date)
  into v_included_members, v_period_start
  from public.workspace_addon_subscriptions subscription
  where subscription.workspace_id = new.workspace_id
    and subscription.addon_key = 'identity'
    and subscription.included_members >= 100000
    and (
      subscription.status in ('active', 'trialing')
      or (subscription.status = 'past_due' and subscription.grace_until > pg_catalog.now())
    );

  if v_included_members is null then return new; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('enterprise-member-overage:' || new.workspace_id::text || ':' || v_period_start::text, 0)
  );

  if not exists (
    select 1 from public.workspace_enterprise_member_overages usage
    where usage.workspace_id = new.workspace_id and usage.period_start = v_period_start
  ) then
    insert into public.workspace_enterprise_member_overages (workspace_id, period_start, user_id)
    select member.workspace_id, v_period_start, member.user_id
    from public.workspace_members member
    where member.workspace_id = new.workspace_id
    on conflict do nothing;
  end if;

  insert into public.workspace_enterprise_member_overages (workspace_id, period_start, user_id)
  values (new.workspace_id, v_period_start, new.user_id)
  on conflict do nothing;

  select pg_catalog.count(*) into v_monthly_unique_members
  from public.workspace_enterprise_member_overages usage
  where usage.workspace_id = new.workspace_id and usage.period_start = v_period_start;

  v_overage_count := greatest(v_monthly_unique_members - v_included_members, 0);

  insert into public.workspace_addon_usage_monthly as usage_monthly (
    workspace_id, addon_key, metric_key, period_start, quantity, updated_at
  ) values (
    new.workspace_id, 'identity', 'member_overage', v_period_start, v_overage_count, pg_catalog.now()
  )
  on conflict (workspace_id, addon_key, metric_key, period_start) do update set
    quantity = greatest(usage_monthly.quantity, excluded.quantity),
    updated_at = excluded.updated_at;

  return new;
end;
$$;

revoke all on function private.record_workspace_enterprise_member_overage() from public, anon, authenticated;

create trigger workspace_enterprise_member_overage_guard
after insert on public.workspace_members
for each row execute function private.record_workspace_enterprise_member_overage();

create or replace function private.seed_workspace_enterprise_member_overages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_start date := coalesce(new.current_period_start::date, pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'UTC')::date);
  v_monthly_unique_members bigint;
  v_overage_count bigint;
begin
  if new.addon_key <> 'identity'
     or new.included_members < 100000
     or not (
       new.status in ('active', 'trialing')
       or (new.status = 'past_due' and new.grace_until > pg_catalog.now())
     ) then
    return new;
  end if;

  insert into public.workspace_enterprise_member_overages (workspace_id, period_start, user_id)
  select member.workspace_id, v_period_start, member.user_id
  from public.workspace_members member
  where member.workspace_id = new.workspace_id
  on conflict do nothing;

  select pg_catalog.count(*) into v_monthly_unique_members
  from public.workspace_enterprise_member_overages usage
  where usage.workspace_id = new.workspace_id and usage.period_start = v_period_start;

  v_overage_count := greatest(v_monthly_unique_members - new.included_members, 0);

  insert into public.workspace_addon_usage_monthly as usage_monthly (
    workspace_id, addon_key, metric_key, period_start, quantity, updated_at
  ) values (
    new.workspace_id, 'identity', 'member_overage', v_period_start, v_overage_count, pg_catalog.now()
  )
  on conflict (workspace_id, addon_key, metric_key, period_start) do update set
    quantity = greatest(usage_monthly.quantity, excluded.quantity),
    updated_at = excluded.updated_at;

  return new;
end;
$$;

revoke all on function private.seed_workspace_enterprise_member_overages() from public, anon, authenticated;

create trigger workspace_enterprise_member_overage_seed
after insert or update of status, included_members, current_period_start
on public.workspace_addon_subscriptions
for each row execute function private.seed_workspace_enterprise_member_overages();
