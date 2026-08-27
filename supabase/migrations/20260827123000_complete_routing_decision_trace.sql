-- Store the complete, content-free calculation trace needed to explain and
-- reproduce each provider routing decision.

alter table public.v2_request_routing_decisions
  add column if not exists score_trace jsonb not null default '{}'::jsonb;

alter table public.v2_request_routing_decisions
  drop constraint if exists v2_request_routing_decisions_score_trace_check;
alter table public.v2_request_routing_decisions
  add constraint v2_request_routing_decisions_score_trace_check check (
    jsonb_typeof(score_trace) = 'object' and pg_column_size(score_trace) <= 16384
  );

create table if not exists public.v2_request_routing_traces (
  request_event_id uuid primary key references public.v2_request_facts(request_event_id) on delete cascade,
  algorithm_version text,
  random_seed bigint,
  selection_method text,
  routing_mode text,
  priority text,
  requested_model text,
  endpoint text,
  final_candidate_count integer,
  pool_bounds jsonb not null default '{}'::jsonb,
  requested_routing jsonb not null default '{}'::jsonb,
  sticky_routing jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint v2_request_routing_traces_candidate_count_check
    check (final_candidate_count is null or final_candidate_count >= 0),
  constraint v2_request_routing_traces_pool_bounds_check
    check (jsonb_typeof(pool_bounds) = 'object' and pg_column_size(pool_bounds) <= 4096),
  constraint v2_request_routing_traces_requested_routing_check
    check (jsonb_typeof(requested_routing) = 'object' and pg_column_size(requested_routing) <= 8192),
  constraint v2_request_routing_traces_sticky_routing_check
    check (jsonb_typeof(sticky_routing) = 'object' and pg_column_size(sticky_routing) <= 4096)
);

alter table public.v2_request_routing_traces enable row level security;

drop policy if exists v2_request_routing_traces_workspace_select
  on public.v2_request_routing_traces;
create policy v2_request_routing_traces_workspace_select
  on public.v2_request_routing_traces
  for select to authenticated
  using (exists (
    select 1
    from public.v2_request_facts request
    where request.request_event_id = v2_request_routing_traces.request_event_id
      and (select public.is_workspace_member(request.workspace_id))
  ));

grant select on public.v2_request_routing_traces to authenticated;
grant select, insert, update, delete on public.v2_request_routing_traces to service_role;

create or replace function public.ingest_v2_gateway_request_with_routing(p_event jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_event_id uuid;
  v_attempts jsonb := coalesce(p_event->'attempts', '[]'::jsonb);
  v_routing_decisions jsonb := coalesce(p_event->'routing_decisions', '[]'::jsonb);
  v_routing_trace jsonb := coalesce(p_event->'routing_trace', '{}'::jsonb);
begin
  if jsonb_typeof(v_routing_decisions) <> 'array'
     or jsonb_array_length(v_routing_decisions) > 128
     or jsonb_typeof(v_routing_trace) <> 'object'
     or pg_column_size(v_routing_trace) > 32768 then
    raise exception using errcode = '22023', message = 'gateway_event_routing_trace_invalid';
  end if;

  v_request_event_id := public.ingest_v2_gateway_request(
    p_event - 'routing_decisions' - 'routing_trace'
  );

  update public.v2_request_attempts attempt
  set provider_model_id = route.provider_model_id
  from jsonb_array_elements(v_attempts) with ordinality as item(value, ordinality)
  cross join lateral (
    select candidate.provider_model_id
    from public.v2_model_provider_routes candidate
    where candidate.provider_model_id = nullif(item.value->>'provider_model_id', '')
       or (
         candidate.provider_slug = nullif(item.value->>'provider', '')
         and candidate.provider_model_id =
           nullif(item.value->>'provider', '') || ':' || nullif(item.value->>'provider_api_model_id', '')
       )
       or (
         candidate.provider_slug = nullif(item.value->>'provider', '')
         and candidate.provider_model_slug = nullif(item.value->>'provider_api_model_id', '')
       )
    order by
      case when candidate.provider_model_id = nullif(item.value->>'provider_model_id', '') then 0 else 1 end,
      candidate.provider_model_id
    limit 1
  ) route
  where attempt.request_event_id = v_request_event_id
    and attempt.attempt_number = greatest(
      1,
      coalesce((item.value->>'attempt_number')::integer, item.ordinality::integer)
    );

  delete from public.v2_request_routing_decisions decision
  where decision.request_event_id = v_request_event_id;

  insert into public.v2_request_routing_decisions (
    request_event_id, decision_order, provider_model_id, provider_slug,
    provider_api_model_id, decision, rank, score, selected, attempted,
    breaker, breaker_until, provider_status, provider_routing_status,
    model_routing_status, capability_status, exclusion_stage, exclusion_reason,
    score_factors, score_trace
  )
  select
    v_request_event_id,
    greatest(1, coalesce((item.value->>'decision_order')::integer, item.ordinality::integer)),
    route.provider_model_id,
    left(nullif(trim(item.value->>'provider'), ''), 256),
    left(nullif(trim(item.value->>'provider_api_model_id'), ''), 512),
    coalesce(nullif(item.value->>'decision', ''), 'ranked'),
    nullif(item.value->>'rank', '')::integer,
    nullif(item.value->>'score', '')::numeric,
    coalesce((item.value->>'selected')::boolean, false),
    coalesce((item.value->>'attempted')::boolean, false),
    left(nullif(item.value->>'breaker', ''), 64),
    case
      when nullif(item.value->>'breaker_until_ms', '') is null then null
      else to_timestamp((item.value->>'breaker_until_ms')::double precision / 1000.0)
    end,
    left(nullif(item.value->>'provider_status', ''), 64),
    left(nullif(item.value->>'provider_routing_status', ''), 64),
    left(nullif(item.value->>'model_routing_status', ''), 64),
    left(nullif(item.value->>'capability_status', ''), 64),
    left(nullif(item.value->>'exclusion_stage', ''), 128),
    left(nullif(item.value->>'exclusion_reason', ''), 256),
    coalesce(item.value->'score_factors', '{}'::jsonb),
    coalesce(item.value->'score_trace', '{}'::jsonb)
  from jsonb_array_elements(v_routing_decisions) with ordinality as item(value, ordinality)
  left join lateral (
    select candidate.provider_model_id
    from public.v2_model_provider_routes candidate
    where candidate.provider_model_id = nullif(item.value->>'provider_model_id', '')
       or (
         candidate.provider_slug = nullif(item.value->>'provider', '')
         and candidate.provider_model_id =
           nullif(item.value->>'provider', '') || ':' || nullif(item.value->>'provider_api_model_id', '')
       )
       or (
         candidate.provider_slug = nullif(item.value->>'provider', '')
         and candidate.provider_model_slug = nullif(item.value->>'provider_api_model_id', '')
       )
    order by
      case when candidate.provider_model_id = nullif(item.value->>'provider_model_id', '') then 0 else 1 end,
      candidate.provider_model_id
    limit 1
  ) route on true
  where nullif(trim(item.value->>'provider'), '') is not null;

  insert into public.v2_request_routing_traces (
    request_event_id, algorithm_version, random_seed, selection_method,
    routing_mode, priority, requested_model, endpoint, final_candidate_count,
    pool_bounds, requested_routing, sticky_routing
  ) values (
    v_request_event_id,
    left(nullif(v_routing_trace#>>'{algorithm,version}', ''), 128),
    nullif(v_routing_trace#>>'{algorithm,seed}', '')::bigint,
    left(nullif(v_routing_trace#>>'{algorithm,selectionMethod}', ''), 64),
    left(nullif(v_routing_trace->>'routing_mode', ''), 64),
    left(nullif(v_routing_trace->>'priority', ''), 64),
    left(nullif(v_routing_trace->>'model', ''), 512),
    left(nullif(v_routing_trace->>'endpoint', ''), 128),
    nullif(v_routing_trace->>'final_candidate_count', '')::integer,
    coalesce(v_routing_trace#>'{algorithm,poolBounds}', '{}'::jsonb),
    coalesce(v_routing_trace->'requested_routing', '{}'::jsonb),
    coalesce(v_routing_trace->'sticky_routing', '{}'::jsonb)
  )
  on conflict (request_event_id) do update set
    algorithm_version = excluded.algorithm_version,
    random_seed = excluded.random_seed,
    selection_method = excluded.selection_method,
    routing_mode = excluded.routing_mode,
    priority = excluded.priority,
    requested_model = excluded.requested_model,
    endpoint = excluded.endpoint,
    final_candidate_count = excluded.final_candidate_count,
    pool_bounds = excluded.pool_bounds,
    requested_routing = excluded.requested_routing,
    sticky_routing = excluded.sticky_routing;

  return v_request_event_id;
end;
$$;

revoke all on function public.ingest_v2_gateway_request_with_routing(jsonb)
  from public, anon, authenticated;
grant execute on function public.ingest_v2_gateway_request_with_routing(jsonb)
  to service_role;

create or replace function public.get_gateway_request_observability(
  p_workspace_id uuid,
  p_request_id text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'request', to_jsonb(gateway_request),
    'fact', case when fact.request_event_id is null then null else to_jsonb(fact) end,
    'routing_trace', case when trace.request_event_id is null then null else to_jsonb(trace) end,
    'attempts', coalesce((select jsonb_agg(to_jsonb(attempt) order by attempt.attempt_number) from public.v2_request_attempts attempt where attempt.request_event_id = fact.request_event_id), '[]'::jsonb),
    'routing_decisions', coalesce((select jsonb_agg(to_jsonb(routing_decision) order by routing_decision.decision_order) from public.v2_request_routing_decisions routing_decision where routing_decision.request_event_id = fact.request_event_id), '[]'::jsonb),
    'usage_meters', coalesce((select jsonb_agg(to_jsonb(usage) order by usage.sequence, usage.meter_key) from public.v2_request_usage usage where usage.request_event_id = fact.request_event_id), '[]'::jsonb),
    'pricing_lines', coalesce((select jsonb_agg(to_jsonb(line) order by line.created_at, line.pricing_line_id) from public.v2_request_pricing_lines line where line.request_event_id = fact.request_event_id), '[]'::jsonb),
    'artifacts', coalesce((select jsonb_agg(to_jsonb(artifact) order by artifact.created_at, artifact.artifact_id) from public.v2_request_artifacts artifact where artifact.request_event_id = fact.request_event_id), '[]'::jsonb),
    'feedback', coalesce((select jsonb_agg(to_jsonb(feedback) order by feedback.created_at, feedback.feedback_id) from public.v2_request_feedback feedback where feedback.request_event_id = fact.request_event_id), '[]'::jsonb)
  )
  from public.gateway_requests gateway_request
  left join public.v2_request_facts fact
    on fact.gateway_request_id = gateway_request.id
   and fact.gateway_request_created_at = gateway_request.created_at
  left join public.v2_request_routing_traces trace
    on trace.request_event_id = fact.request_event_id
  where gateway_request.workspace_id = p_workspace_id
    and gateway_request.request_id = p_request_id
  order by gateway_request.created_at desc
  limit 1;
$$;

revoke all on function public.get_gateway_request_observability(uuid, text)
  from public, anon;
grant execute on function public.get_gateway_request_observability(uuid, text)
  to authenticated, service_role;

comment on table public.v2_request_routing_traces is
  'One content-free, versioned routing algorithm envelope per gateway request.';
comment on column public.v2_request_routing_decisions.score_trace is
  'Bounded raw inputs, normalization values, weights, contributions, and intermediate calculations for one candidate.';
