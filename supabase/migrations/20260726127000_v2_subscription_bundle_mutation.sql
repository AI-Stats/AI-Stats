-- Preserve the importer-facing bundle contract while making V2 subscription
-- tables the sole database target.
create or replace function public.replace_subscription_plan_bundle(
  p_plan jsonb,
  p_models jsonb default '[]'::jsonb,
  p_features jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_uuid uuid;
  v_models jsonb := coalesce(p_models, '[]'::jsonb);
  v_features jsonb := coalesce(p_features, '[]'::jsonb);
begin
  if p_plan is null then raise exception 'p_plan is required'; end if;
  if jsonb_typeof(v_models) <> 'array' then raise exception 'p_models must be a JSON array'; end if;
  if jsonb_typeof(v_features) <> 'array' then raise exception 'p_features must be a JSON array'; end if;

  v_plan_uuid := nullif(p_plan->>'plan_uuid', '')::uuid;
  if v_plan_uuid is null then raise exception 'p_plan.plan_uuid is required'; end if;

  insert into public.v2_subscription_plans (
    plan_uuid, plan_id, name, lab_slug, description, frequency,
    price, currency, link, other_info, created_at, updated_at
  ) values (
    v_plan_uuid,
    p_plan->>'plan_id',
    p_plan->>'name',
    p_plan->>'organisation_id',
    p_plan->>'description',
    p_plan->>'frequency',
    nullif(p_plan->>'price', '')::numeric,
    p_plan->>'currency',
    p_plan->>'link',
    coalesce(p_plan->'other_info', '{}'::jsonb),
    coalesce(nullif(p_plan->>'created_at', '')::timestamptz, now()),
    now()
  )
  on conflict (plan_uuid) do update set
    plan_id = excluded.plan_id,
    name = excluded.name,
    lab_slug = excluded.lab_slug,
    description = excluded.description,
    frequency = excluded.frequency,
    price = excluded.price,
    currency = excluded.currency,
    link = excluded.link,
    other_info = excluded.other_info,
    updated_at = now();

  delete from public.v2_subscription_plan_models where plan_uuid = v_plan_uuid;
  insert into public.v2_subscription_plan_models (
    plan_uuid, model_slug, model_info, rate_limit, other_info
  )
  select
    v_plan_uuid,
    model.model_id,
    coalesce(model.model_info, '{}'::jsonb),
    coalesce(model.rate_limit, '{}'::jsonb),
    coalesce(model.other_info, '{}'::jsonb)
  from jsonb_to_recordset(v_models) as model(
    plan_uuid uuid, model_id text, model_info jsonb, rate_limit jsonb, other_info jsonb
  );

  delete from public.v2_subscription_plan_features where plan_uuid = v_plan_uuid;
  insert into public.v2_subscription_plan_features (
    plan_uuid, feature_name, feature_value, feature_description, other_info
  )
  select
    v_plan_uuid,
    feature.feature_name,
    case
      when feature.feature_value is null then null
      when jsonb_typeof(feature.feature_value) = 'string' then feature.feature_value #>> '{}'
      else feature.feature_value::text
    end,
    feature.feature_description,
    coalesce(feature.other_info, '{}'::jsonb)
  from jsonb_to_recordset(v_features) as feature(
    plan_uuid uuid, feature_name text, feature_value jsonb,
    feature_description text, other_info jsonb
  );
end;
$$;

revoke all on function public.replace_subscription_plan_bundle(jsonb, jsonb, jsonb) from public;
grant execute on function public.replace_subscription_plan_bundle(jsonb, jsonb, jsonb) to service_role;

do $migration$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~* 'public[.](data_models|data_organisations|data_api_providers|data_api_provider_models|data_api_provider_model_capabilities|data_api_pricing_rules|data_subscription_plans|data_subscription_plan_models|data_subscription_plan_features)'
  ) then
    raise exception 'An RPC still depends on a replaced V1 catalogue or subscription table';
  end if;
end
$migration$;

comment on function public.replace_subscription_plan_bundle(jsonb, jsonb, jsonb) is
  'Atomically replaces a subscription plan bundle in canonical V2 tables.';
