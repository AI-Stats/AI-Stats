-- Typed server-side catalogue mutations. The web API validates each payload;
-- this layer enforces admin identity, atomicity, audit history, and V2-only writes.
alter table public.v2_catalogue_admin_changes drop constraint if exists v2_catalogue_admin_changes_resource_type_check;
alter table public.v2_catalogue_admin_changes add constraint v2_catalogue_admin_changes_resource_type_check check (resource_type in ('pricing_sku','organisations','providers','benchmarks','subscription-plans','models','model_graph'));
alter table public.v2_catalogue_admin_changes drop constraint if exists v2_catalogue_admin_changes_action_check;
alter table public.v2_catalogue_admin_changes add constraint v2_catalogue_admin_changes_action_check check (action in ('create','update','delete','save'));
alter table public.v2_catalogue_source_overrides drop constraint if exists v2_catalogue_source_overrides_type_check;
alter table public.v2_catalogue_source_overrides add constraint v2_catalogue_source_overrides_type_check check (source_type in ('pricing_rule','organisations','providers','benchmarks','subscription-plans','models','model'));
alter table public.v2_catalogue_source_overrides drop constraint if exists v2_catalogue_source_overrides_disposition_check;
alter table public.v2_catalogue_source_overrides add constraint v2_catalogue_source_overrides_disposition_check check (disposition in ('database_managed','database','suppressed'));
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
      insert into public.v2_providers(provider_slug,name,status,country_code,base_url,metadata,updated_at)
      values(p_resource_id,p_payload->>'api_provider_name',lower(coalesce(nullif(p_payload->>'status',''),'active')),coalesce(nullif(p_payload->>'country_code',''),'xx'),nullif(p_payload->>'link',''),jsonb_strip_nulls(jsonb_build_object('description',p_payload->>'description','prompt_training_policy',p_payload->>'prompt_training_policy','prompt_training_notes',p_payload->>'prompt_training_notes','prompt_training_source_url',p_payload->>'prompt_training_source_url','data_policy_tier',p_payload->>'data_policy_tier','data_policy_confidence',p_payload->>'data_policy_confidence','data_policy_contract_mode',p_payload->>'data_policy_contract_mode','data_policy_contract_notes',p_payload->>'data_policy_contract_notes','source','admin')),now())
      on conflict(provider_slug) do update set name=excluded.name,status=excluded.status,country_code=excluded.country_code,base_url=excluded.base_url,metadata=public.v2_providers.metadata||excluded.metadata,updated_at=now();
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
    v_uuid := p_resource_id::uuid;
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
      on conflict(model_slug) do update set lab_slug=coalesce(excluded.lab_slug,public.v2_models.lab_slug),name=excluded.name,status=excluded.status,hidden=excluded.hidden,input_modalities=excluded.input_modalities,output_modalities=excluded.output_modalities,family_slug=excluded.family_slug,announced_at=excluded.announced_at,released_at=excluded.released_at,deprecated_at=excluded.deprecated_at,retired_at=excluded.retired_at,metadata=public.v2_models.metadata||excluded.metadata,updated_at=now();
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

create or replace function public.mutate_v2_admin_model_graph(p_actor_user_id uuid,p_model_slug text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_before jsonb; v_after jsonb;
begin
  if not exists(select 1 from public.users where user_id=p_actor_user_id and lower(coalesce(role::text,''))='admin') then raise exception 'actor must have the admin role'; end if;
  select to_jsonb(t) into v_before from public.v2_models t where model_slug=p_model_slug for update;
  if v_before is null then raise exception 'model not found'; end if;

  update public.v2_models set
    name=coalesce(p_payload->>'name',name), lab_slug=coalesce(p_payload->>'organisation_id',lab_slug),
    status=coalesce(lower(p_payload->>'status'),status), hidden=coalesce((p_payload->>'hidden')::boolean,hidden),
    family_slug=case when p_payload ? 'family_id' then nullif(p_payload->>'family_id','') else family_slug end,
    input_modalities=case when p_payload ? 'input_types' then string_to_array(coalesce(p_payload->>'input_types',''),',') else input_modalities end,
    output_modalities=case when p_payload ? 'output_types' then string_to_array(coalesce(p_payload->>'output_types',''),',') else output_modalities end,
    announced_at=case when p_payload ? 'announcement_date' then nullif(p_payload->>'announcement_date','')::timestamptz else announced_at end,
    released_at=case when p_payload ? 'release_date' then nullif(p_payload->>'release_date','')::timestamptz else released_at end,
    deprecated_at=case when p_payload ? 'deprecation_date' then nullif(p_payload->>'deprecation_date','')::timestamptz else deprecated_at end,
    retired_at=case when p_payload ? 'retirement_date' then nullif(p_payload->>'retirement_date','')::timestamptz else retired_at end,
    metadata=metadata||jsonb_strip_nulls(jsonb_build_object('license',p_payload->>'license','previous_model_id',p_payload->>'previous_model_id','source','admin')),updated_at=now()
  where model_slug=p_model_slug;

  if p_payload ? 'family' then
    insert into public.v2_model_families(family_slug,lab_slug,name,metadata,updated_at)
    values(p_payload->'family'->>'family_id',(select lab_slug from public.v2_models where model_slug=p_model_slug),p_payload->'family'->>'family_name',jsonb_strip_nulls(jsonb_build_object('description',p_payload->'family'->>'family_description','source','admin')),now())
    on conflict(family_slug) do update set name=excluded.name,metadata=public.v2_model_families.metadata||excluded.metadata,updated_at=now();
    update public.v2_models set family_slug=p_payload->'family'->>'family_id',updated_at=now() where model_slug=p_model_slug;
  end if;

  if p_payload ? 'model_details' then
    delete from public.v2_model_details where model_slug=p_model_slug;
    insert into public.v2_model_details(model_slug,detail_name,detail_value,detail_order)
    select p_model_slug,x->>'detail_name',coalesce(x->'detail_value',to_jsonb(x->>'detail_value')),100+row_number() over()
    from jsonb_array_elements(p_payload->'model_details') x;
  end if;
  if p_payload ? 'links' then
    delete from public.v2_model_links where model_slug=p_model_slug;
    insert into public.v2_model_links(model_slug,link_kind,title,url,metadata)
    select p_model_slug,coalesce(nullif(x->>'kind',''),x->>'platform'),coalesce(nullif(x->>'title',''),x->>'platform'),x->>'url',jsonb_build_object('source','admin') from jsonb_array_elements(p_payload->'links') x;
  end if;
  if p_payload ? 'benchmark_results' then
    delete from public.v2_benchmark_results where model_slug=p_model_slug;
    insert into public.v2_benchmark_results(model_slug,benchmark_id,score,score_numeric,is_self_reported,other_info,source_link,variant,updated_at)
    select p_model_slug,x->>'benchmark_id',x->>'score',case when (x->>'score')~'^[-+]?[0-9]*\.?[0-9]+$' then (x->>'score')::numeric end,coalesce((x->>'is_self_reported')::boolean,false),nullif(x->>'other_info',''),nullif(x->>'source_link',''),nullif(x->>'variant',''),now() from jsonb_array_elements(p_payload->'benchmark_results') x;
  end if;
  if p_payload ? 'subscription_plan_models' then
    delete from public.v2_subscription_plan_models where model_slug=p_model_slug;
    insert into public.v2_subscription_plan_models(plan_uuid,model_slug,model_info,rate_limit,other_info)
    select (x->>'plan_uuid')::uuid,p_model_slug,coalesce(x->'model_info','{}'::jsonb),coalesce(x->'rate_limit','{}'::jsonb),coalesce(x->'other_info','{}'::jsonb) from jsonb_array_elements(p_payload->'subscription_plan_models') x;
  end if;
  if p_payload ? 'provider_models' then
    insert into public.v2_model_provider_routes(provider_model_id,model_slug,provider_slug,provider_model_slug,status,routing_enabled,input_modalities,output_modalities,context_length,max_output_tokens,effective_from,effective_to,metadata,updated_at)
    select
      case when coalesce(x->>'id','') like 'new-%' or coalesce(x->>'id','')='' then (x->>'provider_id')||':'||p_model_slug||':'||coalesce(nullif(x->>'provider_model_slug',''),x->>'api_model_id') else x->>'id' end,
      p_model_slug,x->>'provider_id',coalesce(nullif(x->>'provider_model_slug',''),x->>'api_model_id'),'active',coalesce((x->>'is_active_gateway')::boolean,false),
      case when jsonb_typeof(x->'input_modalities')='array' then array(select jsonb_array_elements_text(x->'input_modalities')) else string_to_array(coalesce(x->>'input_modalities',''),',') end,
      case when jsonb_typeof(x->'output_modalities')='array' then array(select jsonb_array_elements_text(x->'output_modalities')) else string_to_array(coalesce(x->>'output_modalities',''),',') end,
      nullif(x->>'context_length','')::integer,nullif(x->>'max_output_tokens','')::integer,nullif(x->>'effective_from','')::timestamptz,nullif(x->>'effective_to','')::timestamptz,
      jsonb_strip_nulls(jsonb_build_object('prompt_training_policy_override',x->>'prompt_training_policy_override','prompt_training_override_notes',x->>'prompt_training_override_notes','prompt_training_override_source_url',x->>'prompt_training_override_source_url','quantization_scheme',x->>'quantization_scheme','source','admin')),now()
    from jsonb_array_elements(p_payload->'provider_models') x
    on conflict(provider_model_id) do update set provider_slug=excluded.provider_slug,provider_model_slug=excluded.provider_model_slug,status=excluded.status,routing_enabled=excluded.routing_enabled,input_modalities=excluded.input_modalities,output_modalities=excluded.output_modalities,context_length=excluded.context_length,max_output_tokens=excluded.max_output_tokens,effective_from=excluded.effective_from,effective_to=excluded.effective_to,metadata=public.v2_model_provider_routes.metadata||excluded.metadata,updated_at=now();
    delete from public.v2_model_provider_routes route where route.model_slug=p_model_slug and not exists (
      select 1 from jsonb_array_elements(p_payload->'provider_models') x where route.provider_model_id=case when coalesce(x->>'id','') like 'new-%' or coalesce(x->>'id','')='' then (x->>'provider_id')||':'||p_model_slug||':'||coalesce(nullif(x->>'provider_model_slug',''),x->>'api_model_id') else x->>'id' end
    );
  end if;
  if p_payload ? 'provider_capabilities' then
    delete from public.v2_route_capabilities capability using public.v2_model_provider_routes route where capability.provider_model_id=route.provider_model_id and route.model_slug=p_model_slug;
    insert into public.v2_route_capabilities(provider_model_id,capability_id,status,params,effective_from,effective_to,metadata,updated_at)
    select route.provider_model_id,x->>'capability_id',case when x->>'status' like 'deranked_%' then 'degraded' else coalesce(nullif(x->>'status',''),'active') end,coalesce(x->'params','{}'::jsonb),nullif(x->>'effective_from','')::timestamptz,nullif(x->>'effective_to','')::timestamptz,jsonb_build_object('editor_status',x->>'status','source','admin'),now()
    from jsonb_array_elements(p_payload->'provider_capabilities') x join public.v2_model_provider_routes route on route.model_slug=p_model_slug and route.provider_slug=x->>'provider_id' and route.provider_model_slug=coalesce(nullif(x->>'provider_model_slug',''),x->>'api_model_id');
  end if;
  select to_jsonb(t) into v_after from public.v2_models t where model_slug=p_model_slug;
  insert into public.v2_catalogue_admin_changes(actor_user_id,resource_type,resource_id,action,before_state,after_state)
  values(p_actor_user_id,'model_graph',p_model_slug,'save',v_before,v_after);
  insert into public.v2_catalogue_source_overrides(source_type,source_key,disposition,actor_user_id,resource_id,updated_at)
  values('model',p_model_slug,'database_managed',p_actor_user_id,p_model_slug,now()) on conflict(source_type,source_key) do update set disposition='database_managed',actor_user_id=excluded.actor_user_id,updated_at=now();
  return jsonb_build_object('model',v_after);
end $$;

revoke all on function public.mutate_v2_admin_model_graph(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.mutate_v2_admin_model_graph(uuid,text,jsonb) to service_role;
