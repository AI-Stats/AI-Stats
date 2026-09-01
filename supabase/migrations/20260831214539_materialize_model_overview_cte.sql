-- The overview redaction wrapper references the inner catalogue result several
-- times. Keep that expensive, single-row result materialized so PostgreSQL
-- does not inline and execute the full catalogue projection repeatedly.
create or replace function public.get_v2_model_overview(
  p_model_slug text,
  p_region text default null,
  p_service_tier text default null
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with overview as materialized (
    select public.get_v2_model_overview_without_stealth_redaction(
      p_model_slug,
      p_region,
      p_service_tier
    ) as payload
  ), redacted as (
    select
      overview.payload,
      coalesce(routes.items, '[]'::jsonb) as routes
    from overview
    left join lateral (
      select jsonb_agg(case when route.is_stealth = true then
        (route_item.item - 'variant_id' - 'variant_key') || jsonb_build_object(
          'provider_model_id', 'stealth:' || lower(trim(overview.payload->>'model_id')),
          'provider_slug', 'stealth',
          'provider_name', 'stealth',
          'provider_model_slug', lower(trim(overview.payload->>'model_id')),
          'execution_region', null,
          'data_region', null
        )
        else route_item.item end) as items
      from jsonb_array_elements(
        coalesce(overview.payload->'routes', '[]'::jsonb)
      ) as route_item(item)
      left join public.v2_model_provider_routes route
        on route.provider_model_id = route_item.item->>'provider_model_id'
    ) routes on true
  )
  select case
    when redacted.payload is null or jsonb_typeof(redacted.payload) <> 'object'
      then redacted.payload
    else redacted.payload || jsonb_build_object(
      'routes', redacted.routes,
      'regions', coalesce((
        select jsonb_agg(distinct lower(region.value) order by lower(region.value))
        from jsonb_array_elements(redacted.routes) as route_item(item)
        cross join lateral (values
          (nullif(item->>'execution_region', '')),
          (nullif(item->>'data_region', ''))
        ) as region(value)
        where region.value is not null
      ), '[]'::jsonb)
    )
  end
  from redacted;
$$;

revoke all on function public.get_v2_model_overview(text, text, text) from public;
grant execute on function public.get_v2_model_overview(text, text, text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
