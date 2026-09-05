-- Stealth catalogue rows contain private provider/model identities. They remain database-owned
-- and must never be created, overwritten, or deleted by the public repository JSON importer.
-- phaseo:allow-destructive-migration reason: Widening the disposition check requires replacing
-- the constraint; existing rows and disposition meanings are unchanged.
alter table public.v2_catalogue_source_overrides
  drop constraint if exists v2_catalogue_source_overrides_disposition_check;

alter table public.v2_catalogue_source_overrides
  add constraint v2_catalogue_source_overrides_disposition_check
  check (disposition in ('database_managed', 'database', 'suppressed', 'stealth'))
  not valid;

alter table public.v2_catalogue_source_overrides
  validate constraint v2_catalogue_source_overrides_disposition_check;

alter table public.v2_model_provider_routes
  add column if not exists is_stealth boolean not null default false;

alter table public.v2_model_provider_routes
  add constraint v2_model_provider_routes_stealth_public_id_check
  check (is_stealth = false or provider_model_id like 'stealth:%')
  not valid;

alter table public.v2_model_provider_routes
  validate constraint v2_model_provider_routes_stealth_public_id_check;

comment on column public.v2_model_provider_routes.is_stealth is
  'Keeps the real provider target available to internal service-role routing while every public projection exposes provider identity as exactly stealth; provider_model_id remains a synthetic stealth-prefixed identity.';

create index concurrently if not exists v2_model_provider_routes_stealth_idx
  on public.v2_model_provider_routes (model_slug, provider_model_id)
  where is_stealth = true;

-- Raw Data API reads must not bypass the redacted catalogue projections.
drop policy if exists v2_model_provider_routes_public_select
  on public.v2_model_provider_routes;
create policy v2_model_provider_routes_public_select
  on public.v2_model_provider_routes
  for select to anon, authenticated
  using (
    is_stealth = false
    and status <> 'disabled'
    and (effective_from is null or effective_from <= now())
    and (effective_to is null or effective_to > now())
  );

-- Preserve the installed lifecycle-aware implementation, then put a redaction
-- boundary in front of it. The inner function is deliberately service-only.
alter function public.get_v2_public_models_page_rows(text, text)
  rename to get_v2_public_models_page_rows_without_stealth_redaction;

revoke all on function public.get_v2_public_models_page_rows_without_stealth_redaction(text, text)
  from public, anon, authenticated;
grant execute on function public.get_v2_public_models_page_rows_without_stealth_redaction(text, text)
  to service_role;
revoke all on function public.get_v2_public_models_page_rows_without_lifecycle(text, text)
  from public, anon, authenticated;
grant execute on function public.get_v2_public_models_page_rows_without_lifecycle(text, text)
  to service_role;

create or replace function public.get_v2_public_models_page_rows(
  p_region text default null,
  p_service_tier text default 'standard'
)
returns setof jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with pages as (
    select page.payload
    from public.get_v2_public_models_page_rows_without_stealth_redaction(
      p_region,
      p_service_tier
    ) as page(payload)
  ), redacted as (
    select
      pages.payload,
      coalesce(details.items, '[]'::jsonb) as provider_details
    from pages
    left join lateral (
      select jsonb_agg(distinct case
        when exists (
          select 1
          from public.v2_model_provider_routes route
          where route.is_stealth = true
            and route.model_slug = pages.payload->>'model_id'
            and route.provider_slug = detail.item->>'id'
            and coalesce(route.provider_model_slug, '') = coalesce(detail.item->>'provider_model_slug', '')
        ) then detail.item || jsonb_build_object(
          'id', 'stealth',
          'name', 'stealth',
          'provider_model_slug', pages.payload->>'model_id',
          'execution_region', null,
          'data_region', null
        )
        else detail.item
      end) as items
      from jsonb_array_elements(
        coalesce(pages.payload->'gateway_provider_details', '[]'::jsonb)
      ) as detail(item)
    ) details on true
  )
  select redacted.payload || jsonb_build_object(
    'gateway_provider_details', redacted.provider_details,
    'gateway_provider_names', coalesce((
      select to_jsonb(array_agg(distinct item->>'name' order by item->>'name'))
      from jsonb_array_elements(redacted.provider_details) as detail(item)
      where nullif(item->>'name', '') is not null
    ), '[]'::jsonb),
    'gateway_active_provider_names', coalesce((
      select to_jsonb(array_agg(distinct item->>'name' order by item->>'name'))
      from jsonb_array_elements(redacted.provider_details) as detail(item)
      where item->>'is_active' = 'true'
        and nullif(item->>'name', '') is not null
    ), '[]'::jsonb),
    'gateway_api_model_ids', coalesce((
      select to_jsonb(array_agg(distinct item->>'provider_model_slug' order by item->>'provider_model_slug'))
      from jsonb_array_elements(redacted.provider_details) as detail(item)
      where nullif(item->>'provider_model_slug', '') is not null
    ), '[]'::jsonb),
    'gateway_execution_regions', coalesce((
      select to_jsonb(array_agg(
        distinct lower(coalesce(nullif(item->>'execution_region', ''), nullif(item->>'data_region', '')))
        order by lower(coalesce(nullif(item->>'execution_region', ''), nullif(item->>'data_region', '')))
      ))
      from jsonb_array_elements(redacted.provider_details) as detail(item)
      where coalesce(nullif(item->>'execution_region', ''), nullif(item->>'data_region', '')) is not null
    ), '[]'::jsonb),
    'gateway_provider_count', coalesce((
      select count(distinct item->>'id')
      from jsonb_array_elements(redacted.provider_details) as detail(item)
      where nullif(item->>'id', '') is not null
    ), 0),
    'gateway_active_provider_count', coalesce((
      select count(distinct item->>'id')
      from jsonb_array_elements(redacted.provider_details) as detail(item)
      where item->>'is_active' = 'true'
        and nullif(item->>'id', '') is not null
    ), 0)
  )
  from redacted;
$$;

revoke all on function public.get_v2_public_models_page_rows(text, text) from public;
grant execute on function public.get_v2_public_models_page_rows(text, text)
  to anon, authenticated, service_role;

-- Apply the same boundary to the directly callable pricing RPC. A provider
-- group containing a stealth route is represented solely by the stealth
-- identity, and provider-specific policy metadata is withheld.
alter function public.get_v2_model_pricing(text, text, text)
  rename to get_v2_model_pricing_without_stealth_redaction;

revoke all on function public.get_v2_model_pricing_without_stealth_redaction(text, text, text)
  from public, anon, authenticated;
grant execute on function public.get_v2_model_pricing_without_stealth_redaction(text, text, text)
  to service_role;

create or replace function public.get_v2_model_pricing(
  p_model_slug text,
  p_region text default null,
  p_service_tier text default null
)
returns setof jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with payloads as (
    select pricing.payload
    from public.get_v2_model_pricing_without_stealth_redaction(
      p_model_slug,
      p_region,
      p_service_tier
    ) as pricing(payload)
  ), marked as (
    select
      payloads.payload,
      exists (
        select 1
        from jsonb_array_elements(
          coalesce(payloads.payload->'provider_models', '[]'::jsonb)
        ) as provider_model(item)
        join public.v2_model_provider_routes route
          on route.provider_model_id = provider_model.item->>'id'
        where route.is_stealth = true
      ) as contains_stealth
    from payloads
  )
  select case when marked.contains_stealth then
    marked.payload || jsonb_build_object(
      'provider', (marked.payload->'provider') || jsonb_build_object(
        'api_provider_id', 'stealth',
        'api_provider_name', 'stealth',
        'provider_family_id', 'stealth',
        'offer_label', null,
        'offer_scope', null,
        'country_code', null,
        'colour', null,
        'link', null,
        'residency_mode', null,
        'default_execution_regions', null,
        'default_data_regions', null,
        'zero_data_retention', null,
        'residency_source_url', null,
        'residency_notes', null,
        'prompt_training_policy', null,
        'prompt_training_notes', null,
        'prompt_training_source_url', null,
        'data_policy_tier', null,
        'data_policy_confidence', null,
        'data_policy_contract_mode', null,
        'data_policy_contract_notes', null,
        'user_identifier_policy', null,
        'user_identifier_notes', null,
        'privacy_policy_url', null,
        'terms_of_service_url', null
      ),
      'provider_models', coalesce((
        select jsonb_agg(case when route.is_stealth = true then
          provider_model.item || jsonb_build_object(
            'id', 'stealth:' || coalesce(provider_model.item->>'model_id', p_model_slug),
            'api_provider_id', 'stealth',
            'provider_model_slug', coalesce(provider_model.item->>'model_id', p_model_slug),
            'execution_region', null,
            'data_region', null
          )
          else provider_model.item end)
        from jsonb_array_elements(
          coalesce(marked.payload->'provider_models', '[]'::jsonb)
        ) as provider_model(item)
        left join public.v2_model_provider_routes route
          on route.provider_model_id = provider_model.item->>'id'
      ), '[]'::jsonb),
      'pricing_rules', coalesce((
        select jsonb_agg(case when route.is_stealth = true then
          pricing_rule.item || jsonb_build_object(
            'model_key', regexp_replace(
              coalesce(pricing_rule.item->>'model_key', ''),
              '^[^:]+:',
              'stealth:'
            )
          )
          else pricing_rule.item end
        )
        from jsonb_array_elements(
          coalesce(marked.payload->'pricing_rules', '[]'::jsonb)
        ) as pricing_rule(item)
        left join public.v2_pricing_skus sku
          on sku.sku_id::text = pricing_rule.item->>'id'
        left join public.v2_model_provider_routes route
          on route.provider_model_id = sku.provider_model_id
      ), '[]'::jsonb)
    )
  else marked.payload end
  from marked;
$$;

revoke all on function public.get_v2_model_pricing(text, text, text) from public;
grant execute on function public.get_v2_model_pricing(text, text, text)
  to anon, authenticated, service_role;

-- The overview RPC carries a route list in addition to the page payload, so it
-- needs its own route-level projection.
alter function public.get_v2_model_overview(text, text, text)
  rename to get_v2_model_overview_without_stealth_redaction;

revoke all on function public.get_v2_model_overview_without_stealth_redaction(text, text, text)
  from public, anon, authenticated;
grant execute on function public.get_v2_model_overview_without_stealth_redaction(text, text, text)
  to service_role;

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
  with overview as (
    select public.get_v2_model_overview_without_stealth_redaction(
      p_model_slug,
      p_region,
      p_service_tier
    ) as payload
  )
  select case
    when overview.payload is null or jsonb_typeof(overview.payload) <> 'object'
      then overview.payload
    else overview.payload || jsonb_build_object(
      'routes', coalesce((
        select jsonb_agg(case when route.is_stealth = true then
          route_item.item || jsonb_build_object(
            'provider_model_id', 'stealth:' || lower(trim(overview.payload->>'model_id')),
            'provider_slug', 'stealth',
            'provider_name', 'stealth',
            'provider_model_slug', lower(trim(overview.payload->>'model_id')),
            'execution_region', null,
            'data_region', null
          )
          else route_item.item end)
        from jsonb_array_elements(
          coalesce(overview.payload->'routes', '[]'::jsonb)
        ) as route_item(item)
        left join public.v2_model_provider_routes route
          on route.provider_model_id = route_item.item->>'provider_model_id'
      ), '[]'::jsonb)
    )
  end
  from overview;
$$;

revoke all on function public.get_v2_model_overview(text, text, text) from public;
grant execute on function public.get_v2_model_overview(text, text, text)
  to anon, authenticated, service_role;

-- This compatibility RPC exposes raw route identifiers in a wide table shape.
-- Only the web API uses it, with the service role and an application-level
-- stealth projection, so direct authenticated execution is unnecessary.
revoke all on function public.get_monitor_model_rows(boolean)
  from public, anon, authenticated;
grant execute on function public.get_monitor_model_rows(boolean)
  to service_role;

notify pgrst, 'reload schema';
