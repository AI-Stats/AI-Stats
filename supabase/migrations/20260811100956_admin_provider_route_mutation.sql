alter table public.v2_catalogue_admin_changes drop constraint if exists v2_catalogue_admin_changes_resource_type_check;
alter table public.v2_catalogue_admin_changes add constraint v2_catalogue_admin_changes_resource_type_check
  check (resource_type in ('pricing_sku','organisations','providers','benchmarks','subscription-plans','models','model_graph','provider_route'));
alter table public.v2_catalogue_source_overrides drop constraint if exists v2_catalogue_source_overrides_type_check;
alter table public.v2_catalogue_source_overrides add constraint v2_catalogue_source_overrides_type_check
  check (source_type in ('pricing_rule','organisations','providers','benchmarks','subscription-plans','models','model','provider_route'));

create or replace function public.mutate_v2_admin_provider_route(
  p_actor_user_id uuid,
  p_model_slug text,
  p_route jsonb
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_provider_slug text := nullif(trim(p_route->>'provider_slug'),'');
  v_provider_model_slug text := nullif(trim(p_route->>'provider_model_slug'),'');
  v_provider_model_id text := nullif(trim(p_route->>'provider_model_id'),'');
  v_before jsonb;
  v_after jsonb;
begin
  if not exists(select 1 from public.users where user_id=p_actor_user_id and lower(coalesce(role::text,''))='admin') then raise exception 'actor must have the admin role'; end if;
  if not exists(select 1 from public.v2_models where model_slug=p_model_slug) then raise exception 'model not found'; end if;
  if v_provider_slug is null or not exists(select 1 from public.v2_providers where provider_slug=v_provider_slug) then raise exception 'provider not found'; end if;
  if v_provider_model_slug is null then raise exception 'provider_model_slug is required'; end if;
  if v_provider_model_id is null then v_provider_model_id := v_provider_slug||':'||p_model_slug||':'||v_provider_model_slug; end if;
  select to_jsonb(t) into v_before from public.v2_model_provider_routes t where provider_model_id=v_provider_model_id;
  insert into public.v2_model_provider_routes(
    provider_model_id,model_slug,provider_slug,provider_model_slug,status,routing_enabled,
    input_modalities,output_modalities,regions,context_length,max_output_tokens,
    effective_from,effective_to,metadata,updated_at
  ) values (
    v_provider_model_id,p_model_slug,v_provider_slug,v_provider_model_slug,
    coalesce(nullif(p_route->>'status',''),'active'),coalesce((p_route->>'routing_enabled')::boolean,false),
    case when jsonb_typeof(p_route->'input_modalities')='array' then array(select jsonb_array_elements_text(p_route->'input_modalities')) else '{}'::text[] end,
    case when jsonb_typeof(p_route->'output_modalities')='array' then array(select jsonb_array_elements_text(p_route->'output_modalities')) else '{}'::text[] end,
    case when jsonb_typeof(p_route->'regions')='array' then array(select jsonb_array_elements_text(p_route->'regions')) else '{}'::text[] end,
    nullif(p_route->>'context_length','')::integer,nullif(p_route->>'max_output_tokens','')::integer,
    nullif(p_route->>'effective_from','')::timestamptz,nullif(p_route->>'effective_to','')::timestamptz,
    jsonb_build_object('source','admin'),now()
  ) on conflict(provider_model_id) do update set
    provider_slug=excluded.provider_slug,provider_model_slug=excluded.provider_model_slug,status=excluded.status,
    routing_enabled=excluded.routing_enabled,input_modalities=excluded.input_modalities,output_modalities=excluded.output_modalities,
    regions=excluded.regions,context_length=excluded.context_length,max_output_tokens=excluded.max_output_tokens,
    effective_from=excluded.effective_from,effective_to=excluded.effective_to,
    metadata=public.v2_model_provider_routes.metadata||excluded.metadata,updated_at=now();
  select to_jsonb(t) into v_after from public.v2_model_provider_routes t where provider_model_id=v_provider_model_id;
  insert into public.v2_catalogue_admin_changes(actor_user_id,resource_type,resource_id,action,before_state,after_state)
  values(p_actor_user_id,'provider_route',v_provider_model_id,case when v_before is null then 'create' else 'update' end,v_before,v_after);
  insert into public.v2_catalogue_source_overrides(source_type,source_key,disposition,actor_user_id,resource_id,updated_at)
  values('provider_route',v_provider_model_id,'database_managed',p_actor_user_id,v_provider_model_id,now())
  on conflict(source_type,source_key) do update set disposition='database_managed',actor_user_id=excluded.actor_user_id,resource_id=excluded.resource_id,updated_at=now();
  return v_after;
end $$;

revoke all on function public.mutate_v2_admin_provider_route(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.mutate_v2_admin_provider_route(uuid,text,jsonb) to service_role;
