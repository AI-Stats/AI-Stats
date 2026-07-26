-- External catalogue providers are useful on model detail pages, but they are
-- not Phaseo routing options and must not inflate the /models provider count or
-- appear in its provider hover list.

create or replace function public.get_public_models_page_rows()
returns setof jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with routed as materialized (
    select payload
    from public.get_v2_public_models_page_rows(null, null) payload
  ),
  catalogue_only as (
    select jsonb_build_object(
      'model_id', model.model_slug,
      'name', model.name,
      'description', model.description,
      'organisation_id', model.lab_slug,
      'organisation_name', lab.name,
      'primary_date', coalesce(model.released_at, model.announced_at),
      'primary_timestamp', extract(epoch from coalesce(model.released_at, model.announced_at)) * 1000,
      'primary_group_key', to_char(coalesce(model.released_at, model.announced_at), 'YYYY-MM'),
      'gateway_status', case when model.status = 'draft' then 'coming_soon' else 'not_active' end,
      'gateway_provider_count', 0,
      'gateway_active_provider_count', 0,
      'gateway_endpoints', array[]::text[],
      'gateway_input_modalities', model.input_modalities,
      'gateway_output_modalities', model.output_modalities,
      'gateway_features', array[]::text[],
      'gateway_tiers', array[]::text[],
      'gateway_provider_names', array[]::text[],
      'gateway_active_provider_names', array[]::text[],
      'gateway_execution_regions', array[]::text[],
      'gateway_provider_details', '[]'::jsonb,
      'gateway_api_model_ids', array[]::text[],
      'context_lengths', array[]::integer[],
      'supported_parameters', array[]::text[],
      'pricing_detail_rows', '[]'::jsonb,
      'gateway_monitor_rows', '[]'::jsonb,
      'popularity_tokens_week', null,
      'throughput_week', null,
      'latency_week', null
    ) as payload
    from public.v2_models model
    join public.v2_labs lab on lab.lab_slug = model.lab_slug
    where model.hidden = false
      and model.status <> 'disabled'
      and not exists (
        select 1
        from routed
        where routed.payload->>'model_id' = model.model_slug
      )
  )
  select rows.payload
  from (
    select payload from routed
    union all
    select payload from catalogue_only
  ) rows
  order by
    rows.payload->>'primary_timestamp' desc nulls last,
    rows.payload->>'organisation_name',
    rows.payload->>'name';
$$;

grant execute on function public.get_public_models_page_rows()
  to anon, authenticated, service_role;

comment on function public.get_public_models_page_rows()
  is 'Public V2 model catalogue projection. Counts and provider lists include Phaseo-routable providers only; external catalogue providers are intentionally excluded.';
