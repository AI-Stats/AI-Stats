-- Make provider-level BYOK support explicit so catalogue filters do not need
-- to infer availability from the frontend credential-format registry.

alter table public.v2_providers
  add column if not exists byok_available boolean not null default false;

update public.v2_providers
set byok_available = true,
    updated_at = now()
where provider_slug in (
  'ai21',
  'alibaba',
  'alibaba-cloud',
  'alibaba-cn',
  'amazon-bedrock',
  'anthropic',
  'anthropic-aws',
  'anthropic-aws-us',
  'anthropic-us',
  'atlas-cloud',
  'atlascloud',
  'azure',
  'baseten',
  'cerebras',
  'chutes',
  'cloudflare',
  'cohere',
  'deepinfra',
  'deepseek',
  'google-ai-studio',
  'google-vertex',
  'google-vertex-eu',
  'groq',
  'meta',
  'minimax',
  'mistral',
  'moonshotai',
  'novita',
  'novita-ai',
  'novitaai',
  'openai',
  'parasail',
  'spacex-ai',
  'suno',
  'together',
  'weights-and-biases'
);

comment on column public.v2_providers.byok_available is
  'Whether Phaseo currently supports bringing a provider credential for this provider.';

-- Keep the cached public provider index RPC in sync with the new provider field.
drop function if exists public.get_public_provider_index();

create function public.get_public_provider_index()
returns table (
  provider_slug text,
  provider_name text,
  colour text,
  country_code text,
  provider_family_id text,
  offer_label text,
  offer_scope text,
  is_gateway_provider boolean,
  provider_status text,
  byok_available boolean,
  prompt_training_policy text,
  data_policy_tier text,
  zero_data_retention text,
  data_retention_days integer,
  privacy_policy_url text,
  terms_of_service_url text,
  total_model_ids text[],
  active_model_ids text[],
  free_model_ids text[],
  requests_24h bigint,
  tokens_24h numeric,
  tokens_30d numeric,
  last_updated_at timestamptz,
  text_input_model_ids text[],
  text_output_model_ids text[],
  image_input_model_ids text[],
  image_output_model_ids text[],
  video_input_model_ids text[],
  video_output_model_ids text[],
  audio_input_model_ids text[],
  audio_output_model_ids text[],
  moderation_input_model_ids text[],
  moderation_output_model_ids text[],
  embedding_input_model_ids text[],
  embedding_output_model_ids text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with providers as (
    select
      provider.provider_slug,
      provider.name,
      provider.country_code,
      provider.lab_slug,
      provider.metadata,
      provider.routable,
      provider.routing_enabled,
      provider.status,
      provider.byok_available,
      provider.prompt_training_policy,
      provider.data_policy_tier,
      provider.zero_data_retention,
      provider.data_retention_days
    from public.v2_providers provider
    where lower(provider.provider_slug) not in ('inception', 'inceptron', 'nextbit')
  ),
  eligible_routes as (
    select
      route.provider_slug,
      route.model_slug,
      route.routing_enabled,
      route.status,
      route.effective_from,
      route.effective_to,
      route.updated_at,
      model.variant_kind,
      case
        when cardinality(route.input_modalities) > 0 then route.input_modalities
        else model.input_modalities
      end as input_modalities,
      case
        when cardinality(route.output_modalities) > 0 then route.output_modalities
        else model.output_modalities
      end as output_modalities
    from public.v2_model_provider_routes route
    join providers provider using (provider_slug)
    join public.v2_models model using (model_slug)
    where not model.hidden
  ),
  coverage as (
    select
      route.provider_slug,
      array_agg(distinct route.model_slug order by route.model_slug) as total_model_ids,
      array_agg(distinct route.model_slug order by route.model_slug) filter (
        where route.routing_enabled
          and route.status in ('active', 'degraded')
          and (route.effective_from is null or route.effective_from <= now())
          and (route.effective_to is null or route.effective_to > now())
      ) as active_model_ids,
      array_agg(distinct route.model_slug order by route.model_slug) filter (
        where route.variant_kind = 'free' or lower(route.model_slug) like '%:free'
      ) as free_model_ids,
      max(route.updated_at) as last_updated_at,
      array_agg(distinct route.model_slug order by route.model_slug) filter (where 'text' = any(route.input_modalities)) as text_input_model_ids,
      array_agg(distinct route.model_slug order by route.model_slug) filter (where 'text' = any(route.output_modalities)) as text_output_model_ids,
      array_agg(distinct route.model_slug order by route.model_slug) filter (where 'image' = any(route.input_modalities)) as image_input_model_ids,
      array_agg(distinct route.model_slug order by route.model_slug) filter (where 'image' = any(route.output_modalities)) as image_output_model_ids,
      array_agg(distinct route.model_slug order by route.model_slug) filter (where 'video' = any(route.input_modalities)) as video_input_model_ids,
      array_agg(distinct route.model_slug order by route.model_slug) filter (where 'video' = any(route.output_modalities)) as video_output_model_ids,
      array_agg(distinct route.model_slug order by route.model_slug) filter (where 'audio' = any(route.input_modalities) or 'music' = any(route.input_modalities)) as audio_input_model_ids,
      array_agg(distinct route.model_slug order by route.model_slug) filter (where 'audio' = any(route.output_modalities) or 'music' = any(route.output_modalities)) as audio_output_model_ids,
      array_agg(distinct route.model_slug order by route.model_slug) filter (where 'moderation' = any(route.input_modalities)) as moderation_input_model_ids,
      array_agg(distinct route.model_slug order by route.model_slug) filter (where 'moderation' = any(route.output_modalities)) as moderation_output_model_ids,
      array_agg(distinct route.model_slug order by route.model_slug) filter (where 'embedding' = any(route.input_modalities) or 'embeddings' = any(route.input_modalities)) as embedding_input_model_ids,
      array_agg(distinct route.model_slug order by route.model_slug) filter (where 'embedding' = any(route.output_modalities) or 'embeddings' = any(route.output_modalities)) as embedding_output_model_ids
    from eligible_routes route
    group by route.provider_slug
  ),
  usage as (
    select
      summary.provider as provider_slug,
      summary.requests_24h,
      summary.tokens_24h,
      summary.tokens_30d
    from public.get_public_provider_usage_summary() summary
  )
  select
    provider.provider_slug,
    provider.name,
    nullif(provider.metadata->>'colour', ''),
    coalesce(provider.country_code, ''),
    coalesce(nullif(provider.metadata->>'provider_family_id', ''), provider.lab_slug),
    nullif(provider.metadata->>'offer_label', ''),
    nullif(provider.metadata->>'offer_scope', ''),
    provider.routable
      and provider.routing_enabled
      and provider.status in ('active', 'degraded'),
    provider.status,
    provider.byok_available,
    provider.prompt_training_policy,
    provider.data_policy_tier,
    provider.zero_data_retention,
    provider.data_retention_days,
    nullif(provider.metadata->>'privacy_policy_url', ''),
    nullif(provider.metadata->>'terms_of_service_url', ''),
    coverage.total_model_ids,
    coalesce(coverage.active_model_ids, array[]::text[]),
    coalesce(coverage.free_model_ids, array[]::text[]),
    coalesce(usage.requests_24h, 0),
    coalesce(usage.tokens_24h, 0),
    coalesce(usage.tokens_30d, 0),
    coverage.last_updated_at,
    coalesce(coverage.text_input_model_ids, array[]::text[]),
    coalesce(coverage.text_output_model_ids, array[]::text[]),
    coalesce(coverage.image_input_model_ids, array[]::text[]),
    coalesce(coverage.image_output_model_ids, array[]::text[]),
    coalesce(coverage.video_input_model_ids, array[]::text[]),
    coalesce(coverage.video_output_model_ids, array[]::text[]),
    coalesce(coverage.audio_input_model_ids, array[]::text[]),
    coalesce(coverage.audio_output_model_ids, array[]::text[]),
    coalesce(coverage.moderation_input_model_ids, array[]::text[]),
    coalesce(coverage.moderation_output_model_ids, array[]::text[]),
    coalesce(coverage.embedding_input_model_ids, array[]::text[]),
    coalesce(coverage.embedding_output_model_ids, array[]::text[])
  from providers provider
  join coverage using (provider_slug)
  left join usage using (provider_slug)
  order by provider.name, provider.provider_slug;
$$;

revoke all on function public.get_public_provider_index() from public;
grant execute on function public.get_public_provider_index() to service_role;

comment on function public.get_public_provider_index() is
  'Returns provider coverage rows, lifecycle status, BYOK availability, and policy metadata for the cached public Web API provider index.';

notify pgrst, 'reload schema';

-- Keep the internal provider editor able to maintain the capability flag.
create or replace function public.mutate_v2_admin_catalogue(
  p_actor_user_id uuid, p_resource_type text, p_action text,
  p_resource_id text, p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_before jsonb; v_after jsonb; v_uuid uuid;
begin
  if not exists (select 1 from public.users where user_id = p_actor_user_id and lower(coalesce(role::text, '')) = 'admin') then raise exception 'actor must have the admin role'; end if;
  if p_action not in ('create','update','delete') then raise exception 'unsupported catalogue action'; end if;

  if p_resource_type = 'organisations' then
    select to_jsonb(t) into v_before from public.v2_labs t where lab_slug = p_resource_id;
    if p_action = 'delete' then delete from public.v2_labs where lab_slug = p_resource_id;
    else
      insert into public.v2_labs (lab_slug,name,country_code,description,status,metadata,updated_at)
      values (p_resource_id,p_payload->>'name',coalesce(nullif(p_payload->>'country_code',''),'xx'),nullif(p_payload->>'description',''),'active',jsonb_strip_nulls(jsonb_build_object('colour',p_payload->>'colour','source','admin')),now())
      on conflict (lab_slug) do update set name=excluded.name,country_code=excluded.country_code,description=excluded.description,metadata=public.v2_labs.metadata||excluded.metadata,updated_at=now();
      delete from public.v2_lab_links where lab_slug=p_resource_id;
      insert into public.v2_lab_links(lab_slug,platform,url) select p_resource_id,x->>'platform',x->>'url' from jsonb_array_elements(coalesce(p_payload->'social_links','[]'::jsonb)) x;
    end if;
    select to_jsonb(t) into v_after from public.v2_labs t where lab_slug = p_resource_id;
  elsif p_resource_type = 'providers' then
    select to_jsonb(t) into v_before from public.v2_providers t where provider_slug=p_resource_id;
    if p_action='delete' then delete from public.v2_providers where provider_slug=p_resource_id;
    else
      insert into public.v2_providers(provider_slug,name,status,country_code,base_url,byok_available,metadata,updated_at)
      values(p_resource_id,p_payload->>'api_provider_name',lower(coalesce(nullif(p_payload->>'status',''),'active')),coalesce(nullif(p_payload->>'country_code',''),'xx'),nullif(p_payload->>'link',''),coalesce((p_payload->>'byok_available')::boolean,false),jsonb_strip_nulls(jsonb_build_object('description',p_payload->>'description','prompt_training_policy',p_payload->>'prompt_training_policy','prompt_training_notes',p_payload->>'prompt_training_notes','prompt_training_source_url',p_payload->>'prompt_training_source_url','data_policy_tier',p_payload->>'data_policy_tier','data_policy_confidence',p_payload->>'data_policy_confidence','data_policy_contract_mode',p_payload->>'data_policy_contract_mode','data_policy_contract_notes',p_payload->>'data_policy_contract_notes','source','admin')),now())
      on conflict(provider_slug) do update set name=excluded.name,status=excluded.status,country_code=excluded.country_code,base_url=excluded.base_url,byok_available=case when p_payload ? 'byok_available' then excluded.byok_available else public.v2_providers.byok_available end,metadata=public.v2_providers.metadata||excluded.metadata,updated_at=now();
    end if;
    select to_jsonb(t) into v_after from public.v2_providers t where provider_slug=p_resource_id;
  elsif p_resource_type = 'benchmarks' then
    select to_jsonb(t) into v_before from public.v2_benchmarks t where benchmark_id=p_resource_id;
    if p_action='delete' then delete from public.v2_benchmarks where benchmark_id=p_resource_id;
    else
      insert into public.v2_benchmarks(benchmark_id,name,category,link,ascending_order,updated_at)
      values(p_resource_id,p_payload->>'name',nullif(p_payload->>'category',''),nullif(p_payload->>'link',''),coalesce((p_payload->>'ascending_order')::boolean,false),now())
      on conflict(benchmark_id) do update set name=excluded.name,category=excluded.category,link=excluded.link,ascending_order=excluded.ascending_order,updated_at=now();
    end if;
    select to_jsonb(t) into v_after from public.v2_benchmarks t where benchmark_id=p_resource_id;
  elsif p_resource_type = 'subscription-plans' then
    begin
      v_uuid := p_resource_id::uuid;
    exception when invalid_text_representation then
      raise exception 'subscription plan id must be a UUID';
    end;
    select to_jsonb(t) into v_before from public.v2_subscription_plans t where plan_uuid=v_uuid;
    if p_action='delete' then delete from public.v2_subscription_plans where plan_uuid=v_uuid;
    else
      insert into public.v2_subscription_plans(plan_uuid,plan_id,name,lab_slug,description,frequency,price,currency,link,other_info,updated_at)
      values(v_uuid,p_payload->>'plan_id',p_payload->>'name',nullif(p_payload->>'organisation_id',''),nullif(p_payload->>'description',''),nullif(p_payload->>'frequency',''),nullif(p_payload->>'price','')::numeric,nullif(p_payload->>'currency',''),nullif(p_payload->>'link',''),coalesce(p_payload->'other_info','{}'::jsonb)||jsonb_build_object('source','admin'),now())
      on conflict(plan_uuid) do update set plan_id=excluded.plan_id,name=excluded.name,lab_slug=excluded.lab_slug,description=excluded.description,frequency=excluded.frequency,price=excluded.price,currency=excluded.currency,link=excluded.link,other_info=public.v2_subscription_plans.other_info||excluded.other_info,updated_at=now();
    end if;
    select to_jsonb(t) into v_after from public.v2_subscription_plans t where plan_uuid=v_uuid;
  elsif p_resource_type = 'models' then
    select to_jsonb(t) into v_before from public.v2_models t where model_slug=p_resource_id;
    if p_action='delete' then delete from public.v2_models where model_slug=p_resource_id;
    else
      insert into public.v2_models(model_slug,lab_slug,name,status,hidden,input_modalities,output_modalities,family_slug,announced_at,released_at,deprecated_at,retired_at,metadata,updated_at)
      values(p_resource_id,p_payload->>'organisationId',p_payload->>'name',lower(coalesce(nullif(p_payload->>'status',''),'active')),coalesce((p_payload->>'hidden')::boolean,false),string_to_array(coalesce(p_payload->>'inputTypes',''),','),string_to_array(coalesce(p_payload->>'outputTypes',''),','),nullif(p_payload->>'familyId',''),nullif(p_payload->>'announcementDate','')::timestamptz,nullif(p_payload->>'releaseDate','')::timestamptz,nullif(p_payload->>'deprecationDate','')::timestamptz,nullif(p_payload->>'retirementDate','')::timestamptz,jsonb_strip_nulls(jsonb_build_object('license',p_payload->>'license','previous_model_id',p_payload->>'previousModelId','source','admin')),now())
      on conflict(model_slug) do update set lab_slug=case when p_payload ? 'organisationId' then excluded.lab_slug else public.v2_models.lab_slug end,name=coalesce(p_payload->>'name',public.v2_models.name),status=case when p_payload ? 'status' then excluded.status else public.v2_models.status end,hidden=case when p_payload ? 'hidden' then excluded.hidden else public.v2_models.hidden end,input_modalities=case when p_payload ? 'inputTypes' then excluded.input_modalities else public.v2_models.input_modalities end,output_modalities=case when p_payload ? 'outputTypes' then excluded.output_modalities else public.v2_models.output_modalities end,family_slug=case when p_payload ? 'familyId' then excluded.family_slug else public.v2_models.family_slug end,announced_at=case when p_payload ? 'announcementDate' then excluded.announced_at else public.v2_models.announced_at end,released_at=case when p_payload ? 'releaseDate' then excluded.released_at else public.v2_models.released_at end,deprecated_at=case when p_payload ? 'deprecationDate' then excluded.deprecated_at else public.v2_models.deprecated_at end,retired_at=case when p_payload ? 'retirementDate' then excluded.retired_at else public.v2_models.retired_at end,metadata=public.v2_models.metadata||excluded.metadata,updated_at=now();
    end if;
    select to_jsonb(t) into v_after from public.v2_models t where model_slug=p_resource_id;
  else raise exception 'unsupported catalogue resource'; end if;

  insert into public.v2_catalogue_admin_changes(actor_user_id,resource_type,resource_id,action,before_state,after_state)
  values(p_actor_user_id,p_resource_type,p_resource_id,p_action,v_before,v_after);
  insert into public.v2_catalogue_source_overrides(source_type,source_key,disposition,actor_user_id,resource_id,updated_at)
  values(p_resource_type,p_resource_id,case when p_action='delete' then 'suppressed' else 'database_managed' end,p_actor_user_id,p_resource_id,now())
  on conflict(source_type,source_key) do update set disposition=excluded.disposition,actor_user_id=excluded.actor_user_id,resource_id=excluded.resource_id,updated_at=now();
  return jsonb_build_object('before',v_before,'after',v_after);
end $$;

revoke all on function public.mutate_v2_admin_catalogue(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.mutate_v2_admin_catalogue(uuid,text,text,text,jsonb) to service_role;
