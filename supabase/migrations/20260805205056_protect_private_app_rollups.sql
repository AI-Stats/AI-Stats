drop policy if exists v2_public_usage_daily_public_select
  on public.v2_public_usage_daily;
create policy v2_public_usage_daily_public_select
  on public.v2_public_usage_daily
  for select to anon, authenticated
  using (
    app_id is null
    or exists (
      select 1
      from public.api_apps app
      where app.id = v2_public_usage_daily.app_id
        and coalesce(app.is_public, false)
    )
  );

drop policy if exists v2_public_usage_hourly_public_select
  on public.v2_public_usage_hourly;
create policy v2_public_usage_hourly_public_select
  on public.v2_public_usage_hourly
  for select to anon, authenticated
  using (
    app_id is null
    or exists (
      select 1
      from public.api_apps app
      where app.id = v2_public_usage_hourly.app_id
        and coalesce(app.is_public, false)
    )
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
