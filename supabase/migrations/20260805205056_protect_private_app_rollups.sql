drop policy if exists v2_public_usage_daily_public_select
  on public.v2_public_usage_daily;
create policy v2_public_usage_daily_public_select
  on public.v2_public_usage_daily
  for select to anon, authenticated
  using (
    app_id is null
    or (select public.is_public_api_app(app_id))
  );

drop policy if exists v2_public_usage_hourly_public_select
  on public.v2_public_usage_hourly;
create policy v2_public_usage_hourly_public_select
  on public.v2_public_usage_hourly
  for select to anon, authenticated
  using (
    app_id is null
    or (select public.is_public_api_app(app_id))
  );

drop policy if exists v2_public_usage_daily_meters_public_select
  on public.v2_public_usage_daily_meters;
create policy v2_public_usage_daily_meters_public_select
  on public.v2_public_usage_daily_meters
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.v2_public_usage_daily rollup
      where rollup.rollup_id = v2_public_usage_daily_meters.rollup_id
    )
  );

drop policy if exists v2_public_usage_hourly_meters_public_select
  on public.v2_public_usage_hourly_meters;
create policy v2_public_usage_hourly_meters_public_select
  on public.v2_public_usage_hourly_meters
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.v2_public_usage_hourly rollup
      where rollup.rollup_id = v2_public_usage_hourly_meters.rollup_id
    )
  );

comment on policy v2_public_usage_daily_public_select on public.v2_public_usage_daily is
  'Exposes anonymous usage and usage attributed to explicitly public apps only.';
comment on policy v2_public_usage_hourly_public_select on public.v2_public_usage_hourly is
  'Exposes anonymous usage and usage attributed to explicitly public apps only.';
comment on function public.is_public_api_app(uuid) is
  'RLS-safe public-app visibility lookup that exposes only a boolean classification.';
create or replace function public.is_public_api_app(p_app_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select app.is_public
    from public.api_apps app
    where app.id = p_app_id
  ), false);
$$;

revoke all on function public.is_public_api_app(uuid) from public;
grant execute on function public.is_public_api_app(uuid) to anon, authenticated, service_role;
