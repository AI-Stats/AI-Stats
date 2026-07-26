-- Complete the read-only analytics RPC cutover. Legacy-shaped projections are
-- intentionally named V2 and source only canonical V2 rollups/meters.

create or replace view public.v2_rpc_gateway_model_usage_daily
with (security_invoker = true) as
with meters as (
  select
    meter.rollup_id,
    jsonb_object_agg(meter.meter_key, meter.quantity) as values
  from public.v2_public_usage_daily_meters meter
  group by meter.rollup_id
)
select
  usage.usage_date as day_bucket,
  usage.model_slug as model_id,
  route.provider_slug as provider_id,
  'unknown'::text as endpoint,
  usage.requests,
  usage.successful_requests as success_requests,
  usage.failed_requests,
  0::bigint as neutral_requests,
  usage.rate_limited_requests,
  coalesce(
    (meters.values->>'total_tokens')::numeric,
    (meters.values->>'input_tokens')::numeric + (meters.values->>'output_tokens')::numeric,
    (meters.values->>'input_text_tokens')::numeric + (meters.values->>'output_text_tokens')::numeric,
    0
  )::bigint as total_tokens,
  coalesce((meters.values->>'input_tokens')::numeric, (meters.values->>'input_text_tokens')::numeric, 0)::bigint as input_tokens,
  coalesce((meters.values->>'output_tokens')::numeric, (meters.values->>'output_text_tokens')::numeric, 0)::bigint as output_tokens,
  coalesce((meters.values->>'reasoning_tokens')::numeric, 0)::bigint as reasoning_tokens,
  coalesce((meters.values->>'input_text_tokens')::numeric, 0)::bigint as input_text_tokens,
  coalesce((meters.values->>'output_text_tokens')::numeric, 0)::bigint as output_text_tokens,
  coalesce((meters.values->>'input_image_tokens')::numeric, 0)::bigint as input_image_tokens,
  coalesce((meters.values->>'output_image_tokens')::numeric, 0)::bigint as output_image_tokens,
  coalesce((meters.values->>'input_audio_tokens')::numeric, 0)::bigint as input_audio_tokens,
  coalesce((meters.values->>'output_audio_tokens')::numeric, 0)::bigint as output_audio_tokens,
  coalesce((meters.values->>'input_video_tokens')::numeric, 0)::bigint as input_video_tokens,
  coalesce((meters.values->>'output_video_tokens')::numeric, 0)::bigint as output_video_tokens,
  coalesce((meters.values->>'image_inputs')::numeric, (meters.values->>'input_images')::numeric, 0)::bigint as image_inputs,
  coalesce((meters.values->>'image_outputs')::numeric, (meters.values->>'output_images')::numeric, 0)::bigint as image_outputs,
  coalesce((meters.values->>'audio_inputs')::numeric, 0)::bigint as audio_inputs,
  coalesce((meters.values->>'audio_outputs')::numeric, 0)::bigint as audio_outputs,
  coalesce((meters.values->>'video_inputs')::numeric, 0)::bigint as video_inputs,
  coalesce((meters.values->>'video_outputs')::numeric, 0)::bigint as video_outputs,
  coalesce((meters.values->>'cached_read_tokens')::numeric, (meters.values->>'cached_input_tokens')::numeric, 0)::bigint as cached_read_tokens,
  coalesce((meters.values->>'cached_write_tokens')::numeric, 0)::bigint as cached_write_tokens,
  coalesce((meters.values->>'cached_read_text_tokens')::numeric, 0)::bigint as cached_read_text_tokens,
  coalesce((meters.values->>'cached_write_text_tokens')::numeric, 0)::bigint as cached_write_text_tokens,
  coalesce((meters.values->>'cached_read_image_tokens')::numeric, 0)::bigint as cached_read_image_tokens,
  coalesce((meters.values->>'cached_write_image_tokens')::numeric, 0)::bigint as cached_write_image_tokens,
  coalesce((meters.values->>'cached_read_audio_tokens')::numeric, 0)::bigint as cached_read_audio_tokens,
  coalesce((meters.values->>'cached_write_audio_tokens')::numeric, 0)::bigint as cached_write_audio_tokens,
  coalesce((meters.values->>'cached_read_video_tokens')::numeric, 0)::bigint as cached_read_video_tokens,
  coalesce((meters.values->>'cached_write_video_tokens')::numeric, 0)::bigint as cached_write_video_tokens,
  0::bigint as total_cost_nanos,
  usage.latency_sum_ms,
  usage.latency_count as latency_samples,
  usage.generation_sum_ms,
  usage.generation_count as generation_samples,
  usage.throughput_sum,
  usage.throughput_count as throughput_samples,
  usage.updated_at as last_request_at,
  usage.updated_at as refreshed_at,
  coalesce((meters.values->>'input_quad_tokens')::numeric, 0)::bigint as input_quad_tokens,
  coalesce((meters.values->>'output_quad_tokens')::numeric, 0)::bigint as output_quad_tokens,
  coalesce((meters.values->>'total_quad_tokens')::numeric, 0)::bigint as total_quad_tokens,
  coalesce((meters.values->>'cached_write_text_tokens_5m')::numeric, 0)::bigint as cached_write_text_tokens_5m,
  coalesce((meters.values->>'cached_write_text_tokens_1h')::numeric, 0)::bigint as cached_write_text_tokens_1h,
  coalesce((meters.values->>'text_quad_tokens')::numeric, 0)::bigint as text_quad_tokens,
  coalesce((meters.values->>'rerank_quad_tokens')::numeric, 0)::bigint as rerank_quad_tokens,
  coalesce((meters.values->>'embedding_quad_tokens')::numeric, 0)::bigint as embedding_quad_tokens,
  coalesce((meters.values->>'moderation_quad_tokens')::numeric, 0)::bigint as moderation_quad_tokens,
  coalesce((meters.values->>'ocr_quad_tokens')::numeric, 0)::bigint as ocr_quad_tokens,
  coalesce((meters.values->>'image_megapixels')::numeric, 0) as image_megapixels,
  coalesce((meters.values->>'audio_seconds')::numeric, 0) as audio_seconds,
  coalesce((meters.values->>'video_pixel_seconds')::numeric, 0) as video_pixel_seconds,
  coalesce((meters.values->>'input_characters')::numeric, 0)::bigint as input_characters,
  coalesce((meters.values->>'output_characters')::numeric, 0)::bigint as output_characters,
  coalesce((meters.values->>'total_characters')::numeric, 0)::bigint as total_characters,
  coalesce((meters.values->>'embedding_tokens')::numeric, 0)::bigint as embedding_tokens,
  coalesce((meters.values->>'video_seconds')::numeric, 0) as video_seconds
from public.v2_public_usage_daily usage
left join public.v2_model_provider_routes route
  on route.provider_model_id = usage.provider_model_id
left join meters on meters.rollup_id = usage.rollup_id;

create or replace view public.v2_rpc_public_app_model_usage_daily
with (security_invoker = true) as
select
  usage.day_bucket,
  usage.app_id::text,
  usage.canonical_model_id as model_id,
  usage.requests,
  usage.total_tokens::bigint as tokens,
  now() as refreshed_at
from public.v2_web_public_usage_daily usage
join public.api_apps app on app.id = usage.app_id and app.is_public = true;

create or replace view public.v2_rpc_gateway_usage_rollup_daily_app
with (security_invoker = true) as
select
  usage.day_bucket::timestamptz as day_bucket,
  usage.app_id,
  sum(usage.requests)::bigint as requests,
  sum(usage.success_requests)::bigint as success_requests,
  sum(usage.total_tokens)::bigint as total_tokens,
  sum(usage.total_cost_nanos)::bigint as total_cost_nanos,
  count(distinct usage.canonical_model_id)::integer as unique_models
from public.v2_web_public_usage_daily usage
where usage.app_id is not null
group by usage.day_bucket, usage.app_id;

create or replace view public.v2_rpc_gateway_activity_rollup_daily
with (security_invoker = true) as
select
  usage.usage_date as day_bucket,
  usage.workspace_id as team_id,
  usage.model_slug as model_id,
  'unknown'::text as endpoint,
  route.provider_slug as provider,
  0::bigint as usage_nanos,
  0::bigint as byok_usage_nanos,
  usage.requests,
  0::bigint as prompt_tokens,
  0::bigint as completion_tokens,
  0::bigint as reasoning_tokens,
  usage.updated_at
from public.v2_private_usage_daily usage
left join public.v2_model_provider_routes route
  on route.provider_model_id = usage.provider_model_id;

grant select on public.v2_rpc_gateway_model_usage_daily,
  public.v2_rpc_public_app_model_usage_daily,
  public.v2_rpc_gateway_usage_rollup_daily_app,
  public.v2_rpc_gateway_activity_rollup_daily
to anon, authenticated, service_role;

do $migration$
declare
  proc record;
  definition text;
begin
  for proc in
    select p.oid, n.nspname, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~* '(gateway_usage_rollup_15m|gateway_usage_rollup_daily_app|gateway_model_usage_daily|public_app_model_usage_daily|gateway_activity_rollup_daily)'
  loop
    definition := pg_get_functiondef(proc.oid);
    if definition ~* '(insert\s+into|update|delete\s+from)\s+public\.(gateway_usage_rollup_|gateway_model_usage_daily|public_app_model_usage_daily|gateway_activity_rollup_daily)' then
      continue;
    end if;
    definition := replace(definition, 'public.gateway_usage_rollup_15m_model_provider', 'public.v2_web_public_usage_hourly');
    definition := replace(definition, 'public.gateway_usage_rollup_15m_provider_app', 'public.v2_web_public_usage_hourly');
    definition := replace(definition, 'public.gateway_usage_rollup_15m_app_model', 'public.v2_web_public_usage_hourly');
    definition := replace(definition, 'public.gateway_usage_rollup_15m_workspace_provider_model', 'public.v2_web_private_usage_daily');
    definition := replace(definition, 'public.gateway_usage_rollup_daily_app_model', 'public.v2_web_public_usage_daily');
    definition := replace(definition, 'public.gateway_usage_rollup_daily_app', 'public.v2_rpc_gateway_usage_rollup_daily_app');
    definition := replace(definition, 'public.gateway_model_usage_daily', 'public.v2_rpc_gateway_model_usage_daily');
    definition := replace(definition, 'public.public_app_model_usage_daily', 'public.v2_rpc_public_app_model_usage_daily');
    definition := replace(definition, 'public.gateway_activity_rollup_daily', 'public.v2_rpc_gateway_activity_rollup_daily');
    execute definition;
  end loop;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~* '(from|join)\s+public\.(gateway_usage_rollup_15m|gateway_usage_rollup_daily_app|gateway_model_usage_daily|public_app_model_usage_daily|gateway_activity_rollup_daily)'
      and pg_get_functiondef(p.oid) !~* '(insert\s+into|update|delete\s+from)\s+public\.(gateway_usage_rollup_|gateway_model_usage_daily|public_app_model_usage_daily|gateway_activity_rollup_daily)'
  ) then
    raise exception 'Read-only analytics RPC cutover left a V1 rollup dependency';
  end if;
end
$migration$;
