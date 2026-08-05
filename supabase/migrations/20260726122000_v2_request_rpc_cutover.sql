-- Legacy-shaped, read-only request projection backed exclusively by V2 facts.
-- It exists only to preserve established RPC result contracts during the hard
-- cutover; new SQL should query V2 facts/rollups directly.
create or replace view public.v2_rpc_gateway_requests_legacy_shape
with (security_invoker = true) as
select
  fact.request_event_id as id,
  fact.occurred_at as created_at,
  fact.workspace_id as team_id,
  fact.workspace_id,
  fact.request_id,
  fact.app_id,
  fact.endpoint,
  coalesce(fact.routed_model_slug, fact.requested_model_slug, fact.requested_model_input) as model_id,
  fact.requested_model_input as requested_model_id,
  fact.routed_model_slug as routed_model_id,
  coalesce(fact.routed_model_slug, fact.requested_model_slug) as canonical_model_id,
  route.provider_slug as provider,
  fact.native_response_id,
  fact.stream,
  fact.byok,
  fact.status_code,
  fact.success,
  fact.error_code,
  fact.safe_metadata->>'error_message' as error_message,
  fact.latency_ms,
  fact.generation_ms,
  fact.gateway_total_ms as e2e_latency_ms,
  coalesce(usage.payload, '{}'::jsonb) as usage,
  coalesce(usage.total_tokens, 0)::bigint as usage_total_tokens,
  coalesce((usage.payload->>'input_tokens')::numeric, 0)::bigint as usage_input_tokens,
  coalesce((usage.payload->>'output_tokens')::numeric, 0)::bigint as usage_output_tokens,
  coalesce((usage.payload->>'reasoning_tokens')::numeric, 0)::bigint as usage_reasoning_tokens,
  coalesce((usage.payload->>'input_text_tokens')::numeric, 0)::bigint as usage_input_text_tokens,
  coalesce((usage.payload->>'output_text_tokens')::numeric, 0)::bigint as usage_output_text_tokens,
  coalesce((usage.payload->>'input_image_tokens')::numeric, 0)::bigint as usage_input_image_tokens,
  coalesce((usage.payload->>'output_image_tokens')::numeric, 0)::bigint as usage_output_image_tokens,
  coalesce((usage.payload->>'input_audio_tokens')::numeric, 0)::bigint as usage_input_audio_tokens,
  coalesce((usage.payload->>'output_audio_tokens')::numeric, 0)::bigint as usage_output_audio_tokens,
  coalesce((usage.payload->>'input_video_tokens')::numeric, 0)::bigint as usage_input_video_tokens,
  coalesce((usage.payload->>'output_video_tokens')::numeric, 0)::bigint as usage_output_video_tokens,
  coalesce((usage.payload->>'image_inputs')::numeric, 0)::bigint as usage_image_inputs,
  coalesce((usage.payload->>'image_outputs')::numeric, 0)::bigint as usage_image_outputs,
  coalesce((usage.payload->>'audio_inputs')::numeric, 0)::bigint as usage_audio_inputs,
  coalesce((usage.payload->>'audio_outputs')::numeric, 0)::bigint as usage_audio_outputs,
  coalesce((usage.payload->>'video_inputs')::numeric, 0)::bigint as usage_video_inputs,
  coalesce((usage.payload->>'video_outputs')::numeric, 0)::bigint as usage_video_outputs,
  coalesce((usage.payload->>'cached_read_tokens')::numeric, (usage.payload->>'cached_input_tokens')::numeric, 0)::bigint as usage_cached_read_tokens,
  coalesce((usage.payload->>'cached_write_tokens')::numeric, 0)::bigint as usage_cached_write_tokens,
  coalesce((usage.payload->>'cached_read_text_tokens')::numeric, 0)::bigint as usage_cached_read_text_tokens,
  coalesce((usage.payload->>'cached_write_text_tokens')::numeric, 0)::bigint as usage_cached_write_text_tokens,
  coalesce((usage.payload->>'cached_write_text_tokens_5m')::numeric, 0)::bigint as usage_cached_write_text_tokens_5m,
  coalesce((usage.payload->>'cached_write_text_tokens_1h')::numeric, 0)::bigint as usage_cached_write_text_tokens_1h,
  coalesce((usage.payload->>'cached_read_image_tokens')::numeric, 0)::bigint as usage_cached_read_image_tokens,
  coalesce((usage.payload->>'cached_write_image_tokens')::numeric, 0)::bigint as usage_cached_write_image_tokens,
  coalesce((usage.payload->>'cached_read_audio_tokens')::numeric, 0)::bigint as usage_cached_read_audio_tokens,
  coalesce((usage.payload->>'cached_write_audio_tokens')::numeric, 0)::bigint as usage_cached_write_audio_tokens,
  coalesce((usage.payload->>'cached_read_video_tokens')::numeric, 0)::bigint as usage_cached_read_video_tokens,
  coalesce((usage.payload->>'cached_write_video_tokens')::numeric, 0)::bigint as usage_cached_write_video_tokens,
  coalesce((usage.payload->>'input_quad_tokens')::numeric, 0)::bigint as usage_input_quad_tokens,
  coalesce((usage.payload->>'output_quad_tokens')::numeric, 0)::bigint as usage_output_quad_tokens,
  coalesce((usage.payload->>'total_quad_tokens')::numeric, 0)::bigint as usage_total_quad_tokens,
  coalesce((usage.payload->>'text_quad_tokens')::numeric, 0)::bigint as usage_text_quad_tokens,
  coalesce((usage.payload->>'rerank_quad_tokens')::numeric, 0)::bigint as usage_rerank_quad_tokens,
  coalesce((usage.payload->>'embedding_quad_tokens')::numeric, 0)::bigint as usage_embedding_quad_tokens,
  coalesce((usage.payload->>'moderation_quad_tokens')::numeric, 0)::bigint as usage_moderation_quad_tokens,
  coalesce((usage.payload->>'ocr_quad_tokens')::numeric, 0)::bigint as usage_ocr_quad_tokens,
  coalesce((usage.payload->>'image_megapixels')::numeric, 0) as usage_image_megapixels,
  coalesce((usage.payload->>'audio_seconds')::numeric, 0) as usage_audio_seconds,
  coalesce((usage.payload->>'video_pixel_seconds')::numeric, 0) as usage_video_pixel_seconds,
  coalesce((usage.payload->>'input_characters')::numeric, 0)::bigint as usage_input_characters,
  coalesce((usage.payload->>'output_characters')::numeric, 0)::bigint as usage_output_characters,
  coalesce((usage.payload->>'total_characters')::numeric, 0)::bigint as usage_total_characters,
  fact.occurred_at as usage_normalized_at,
  fact.cost_nanos,
  fact.currency,
  coalesce(pricing.payload, '[]'::jsonb) as pricing_lines,
  fact.key_id,
  fact.throughput,
  coalesce(fact.cloudflare_colo, fact.region) as location,
  fact.auth_method,
  fact.safe_metadata->>'oauth_client_id' as oauth_client_id,
  nullif(fact.safe_metadata->>'oauth_user_id', '')::uuid as oauth_user_id,
  fact.end_user_id,
  fact.session_id,
  fact.safe_metadata->'trace_data' as trace_data,
  coalesce(attempts.payload, '[]'::jsonb) as provider_attempts,
  fact.stop_reason,
  fact.stop_reason as finish_reason,
  fact.tool_call_count,
  fact.structured_output_attempted,
  fact.structured_output_succeeded,
  fact.cloudflare_colo
from public.v2_request_facts fact
left join public.v2_model_provider_routes route on route.provider_model_id = fact.provider_model_id
left join lateral (
  select
    jsonb_object_agg(meter_key, quantity) as payload,
    sum(quantity) filter (where meter_key in ('input_tokens', 'output_tokens')) as total_tokens
  from (
    select request_usage.meter_key, sum(request_usage.quantity) as quantity
    from public.v2_request_usage request_usage
    where request_usage.request_event_id = fact.request_event_id
    group by request_usage.meter_key
  ) grouped_usage
) usage on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'sku_id', line.sku_id,
      'sku_meter_id', line.sku_meter_id,
      'meter', line.meter_key,
      'quantity', line.quantity,
      'unit', line.unit,
      'unit_price_nanos', line.unit_price_nanos,
      'cost_nanos', line.charged_nanos
    ) order by line.created_at, line.pricing_line_id
  ) as payload
  from public.v2_request_pricing_lines line
  where line.request_event_id = fact.request_event_id
) pricing on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'attempt', attempt.attempt_number,
      'provider_model_id', attempt.provider_model_id,
      'provider', attempt_route.provider_slug,
      'started_at', attempt.started_at,
      'completed_at', attempt.completed_at,
      'status_code', attempt.status_code,
      'success', attempt.success,
      'error_code', attempt.error_code,
      'failure_class', attempt.failure_class,
      'latency_ms', attempt.latency_ms
    ) order by attempt.attempt_number
  ) as payload
  from public.v2_request_attempts attempt
  left join public.v2_model_provider_routes attempt_route
    on attempt_route.provider_model_id = attempt.provider_model_id
  where attempt.request_event_id = fact.request_event_id
) attempts on true;

grant select on public.v2_rpc_gateway_requests_legacy_shape
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
      and p.proname <> 'ensure_gateway_requests_partitions'
      and pg_get_functiondef(p.oid) ~ 'public\.gateway_requests\M'
  loop
    definition := pg_get_functiondef(proc.oid);
    if definition ~* '(insert\s+into|update|delete\s+from)\s+public\.gateway_requests\M' then
      continue;
    end if;
    definition := replace(
      definition,
      'public.gateway_requests',
      'public.v2_rpc_gateway_requests_legacy_shape'
    );
    definition := replace(definition, 'public.is_team_member', 'public.is_workspace_member');
    raise notice 'Recompiling %.% against V2 request facts', proc.nspname, proc.proname;
    execute definition;
  end loop;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~* '(from|join)\s+public\.gateway_requests\M'
      and pg_get_functiondef(p.oid) !~* '(insert\s+into|update|delete\s+from)\s+public\.gateway_requests\M'
  ) then
    raise exception 'Read-only RPC request cutover left a V1 gateway_requests dependency';
  end if;
end
$migration$;
