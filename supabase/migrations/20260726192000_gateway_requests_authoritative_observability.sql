-- Keep gateway_requests as the authoritative operational request record.
-- V2 request facts are an observability extension used for normalized attempts,
-- routing decisions, meters, pricing snapshots, artifacts, and rollups.

alter table public.v2_request_facts
  add column if not exists gateway_request_id uuid,
  add column if not exists gateway_request_created_at timestamptz;

create or replace function public.attach_v2_request_fact_to_gateway_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.gateway_request_id is null or new.gateway_request_created_at is null then
    select request.id, request.created_at
    into new.gateway_request_id, new.gateway_request_created_at
    from public.gateway_requests request
    where request.workspace_id = new.workspace_id
      and request.request_id = new.request_id
    order by
      case when request.created_at = new.occurred_at then 0 else 1 end,
      abs(extract(epoch from (request.created_at - new.occurred_at))),
      request.created_at desc
    limit 1;
  end if;

  if new.gateway_request_id is null or new.gateway_request_created_at is null then
    raise exception using
      errcode = '23503',
      message = 'v2_request_fact_requires_gateway_request';
  end if;

  return new;
end;
$$;

drop trigger if exists v2_request_facts_attach_gateway_request
  on public.v2_request_facts;
create trigger v2_request_facts_attach_gateway_request
before insert or update of workspace_id, request_id, occurred_at,
  gateway_request_id, gateway_request_created_at
on public.v2_request_facts
for each row
execute function public.attach_v2_request_fact_to_gateway_request();

-- Bring requests created after the original observability backfill into the
-- extension table before enforcing the one-to-one authoritative link. Raw I/O
-- remains outside Postgres; only narrow request facts are copied.
insert into public.v2_request_facts (
  workspace_id,
  request_id,
  occurred_at,
  app_id,
  key_id,
  endpoint,
  requested_model_input,
  requested_model_slug,
  routed_model_slug,
  provider_model_id,
  status_code,
  success,
  error_code,
  stop_reason,
  tool_call_count,
  stream,
  byok,
  latency_ms,
  time_to_first_token_ms,
  generation_ms,
  upstream_attempt_count,
  throughput,
  session_id,
  end_user_id,
  auth_method,
  native_response_id,
  cost_nanos,
  currency,
  safe_metadata,
  gateway_request_id,
  gateway_request_created_at
)
select
  request.workspace_id,
  request.request_id,
  request.created_at,
  request.app_id,
  request.key_id,
  coalesce(nullif(trim(request.endpoint), ''), 'unknown'),
  coalesce(
    nullif(trim(request.requested_model_id), ''),
    nullif(trim(request.model_id), ''),
    'unknown'
  ),
  requested_model.model_slug,
  routed_model.model_slug,
  route.provider_model_id,
  request.status_code,
  coalesce(request.success, false),
  request.error_code,
  request.finish_reason,
  case
    when coalesce(
      request.usage->>'tool_call_count',
      request.usage->>'request_tool_count'
    ) ~ '^[0-9]+$'
      then coalesce(
        request.usage->>'tool_call_count',
        request.usage->>'request_tool_count'
      )::integer
    else 0
  end,
  coalesce(request.stream, false),
  coalesce(request.byok, false),
  request.latency_ms,
  request.latency_ms,
  request.generation_ms,
  case when request.provider is null then 0 else 1 end,
  request.throughput,
  request.session_id,
  request.end_user_id,
  request.auth_method,
  request.native_response_id,
  request.cost_nanos,
  coalesce(nullif(trim(request.currency), ''), 'USD'),
  jsonb_build_object(
    'authoritative_gateway_request_id', request.id,
    'legacy_provider', request.provider
  ),
  request.id,
  request.created_at
from public.gateway_requests request
left join public.v2_models requested_model
  on requested_model.model_slug = lower(coalesce(
    nullif(trim(request.requested_model_id), ''),
    nullif(trim(request.model_id), '')
  ))
left join public.v2_models routed_model
  on routed_model.model_slug = lower(coalesce(
    nullif(trim(request.routed_model_id), ''),
    nullif(trim(request.model_id), '')
  ))
left join lateral (
  select candidate.provider_model_id
  from public.v2_model_provider_routes candidate
  where candidate.provider_slug = lower(nullif(trim(request.provider), ''))
    and candidate.model_slug = routed_model.model_slug
  order by
    candidate.routing_enabled desc,
    candidate.effective_from desc nulls last,
    candidate.provider_model_id
  limit 1
) route on true
where not exists (
  select 1
  from public.v2_request_facts fact
  where fact.workspace_id = request.workspace_id
    and fact.request_id = request.request_id
)
on conflict (workspace_id, request_id) do nothing;

insert into public.v2_request_usage (
  request_event_id,
  meter_key,
  modality,
  unit,
  quantity,
  source,
  billable
)
select
  fact.request_event_id,
  meter.meter_key,
  'text',
  'token',
  meter.quantity,
  'gateway_request_backfill',
  true
from public.gateway_requests request
join public.v2_request_facts fact
  on fact.gateway_request_id = request.id
 and fact.gateway_request_created_at = request.created_at
cross join lateral (
  values
    ('input_tokens', case when request.usage->>'input_tokens' ~ '^[0-9]+(\.[0-9]+)?$' then (request.usage->>'input_tokens')::numeric else 0 end),
    ('cached_input_tokens', case when request.usage->'input_tokens_details'->>'cached_tokens' ~ '^[0-9]+(\.[0-9]+)?$' then (request.usage->'input_tokens_details'->>'cached_tokens')::numeric else 0 end),
    ('output_tokens', case when request.usage->>'output_tokens' ~ '^[0-9]+(\.[0-9]+)?$' then (request.usage->>'output_tokens')::numeric else 0 end),
    ('reasoning_tokens', case when request.usage->'output_tokens_details'->>'reasoning_tokens' ~ '^[0-9]+(\.[0-9]+)?$' then (request.usage->'output_tokens_details'->>'reasoning_tokens')::numeric else 0 end)
) as meter(meter_key, quantity)
where meter.quantity > 0
on conflict (request_event_id, meter_key, sequence) do update set
  quantity = excluded.quantity,
  source = excluded.source;

with candidates as (
  select
    fact.request_event_id,
    request.id as gateway_request_id,
    request.created_at as gateway_request_created_at,
    row_number() over (
      partition by fact.request_event_id
      order by
        case when request.created_at = fact.occurred_at then 0 else 1 end,
        abs(extract(epoch from (request.created_at - fact.occurred_at))),
        request.created_at desc
    ) as candidate_rank
  from public.v2_request_facts fact
  join public.gateway_requests request
    on request.workspace_id = fact.workspace_id
   and request.request_id = fact.request_id
  where fact.gateway_request_id is null
     or fact.gateway_request_created_at is null
)
update public.v2_request_facts fact
set
  gateway_request_id = candidate.gateway_request_id,
  gateway_request_created_at = candidate.gateway_request_created_at
from candidates candidate
where candidate.request_event_id = fact.request_event_id
  and candidate.candidate_rank = 1;

do $$
begin
  if exists (
    select 1
    from public.v2_request_facts fact
    where fact.gateway_request_id is null
       or fact.gateway_request_created_at is null
  ) then
    raise exception 'Cannot attach every V2 request fact to gateway_requests';
  end if;
end
$$;

alter table public.v2_request_facts
  alter column gateway_request_id set not null,
  alter column gateway_request_created_at set not null;

alter table public.v2_request_facts
  drop constraint if exists v2_request_facts_gateway_request_fkey;
alter table public.v2_request_facts
  add constraint v2_request_facts_gateway_request_fkey
  foreign key (gateway_request_id, gateway_request_created_at)
  references public.gateway_requests (id, created_at)
  on delete cascade;

create unique index if not exists v2_request_facts_gateway_request_key
  on public.v2_request_facts (gateway_request_id, gateway_request_created_at);

comment on table public.v2_request_facts is
  'Queryable observability extension for one authoritative gateway_requests row; raw bodies never belong in Supabase.';
comment on column public.v2_request_facts.gateway_request_id is
  'Identifier of the authoritative gateway_requests row extended by this fact.';
comment on column public.v2_request_facts.gateway_request_created_at is
  'Partition key of the authoritative gateway_requests row extended by this fact.';

-- Existing analytical RPCs may continue to use the V2 compatibility view.
-- Operational request identity, exact logs, billing, refunds, and lifecycle
-- finalization read gateway_requests directly in application code. Rewriting
-- arbitrary stored-function source here would be unsafe because the
-- compatibility view intentionally exposes legacy aliases such as team_id.

comment on view public.v2_rpc_gateway_requests_legacy_shape is
  'Analytics compatibility projection only. gateway_requests remains the authoritative operational request record.';
comment on view public.v2_web_gateway_requests is
  'Analytics compatibility projection only. Do not use for exact logs, billing, refunds, lifecycle finalization, or request identity.';

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
    'fact', case
      when fact.request_event_id is null then null
      else to_jsonb(fact)
    end,
    'attempts', coalesce((
      select jsonb_agg(to_jsonb(attempt) order by attempt.attempt_number)
      from public.v2_request_attempts attempt
      where attempt.request_event_id = fact.request_event_id
    ), '[]'::jsonb),
    'routing_decisions', coalesce((
      select jsonb_agg(to_jsonb(decision) order by decision.decision_order)
      from public.v2_request_routing_decisions decision
      where decision.request_event_id = fact.request_event_id
    ), '[]'::jsonb),
    'usage_meters', coalesce((
      select jsonb_agg(to_jsonb(usage) order by usage.sequence, usage.meter_key)
      from public.v2_request_usage usage
      where usage.request_event_id = fact.request_event_id
    ), '[]'::jsonb),
    'pricing_lines', coalesce((
      select jsonb_agg(to_jsonb(line) order by line.created_at, line.pricing_line_id)
      from public.v2_request_pricing_lines line
      where line.request_event_id = fact.request_event_id
    ), '[]'::jsonb),
    'artifacts', coalesce((
      select jsonb_agg(to_jsonb(artifact) order by artifact.created_at, artifact.artifact_id)
      from public.v2_request_artifacts artifact
      where artifact.request_event_id = fact.request_event_id
    ), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_agg(to_jsonb(feedback) order by feedback.created_at, feedback.feedback_id)
      from public.v2_request_feedback feedback
      where feedback.request_event_id = fact.request_event_id
    ), '[]'::jsonb)
  )
  from public.gateway_requests gateway_request
  left join public.v2_request_facts fact
    on fact.gateway_request_id = gateway_request.id
   and fact.gateway_request_created_at = gateway_request.created_at
  where gateway_request.workspace_id = p_workspace_id
    and gateway_request.request_id = p_request_id
  order by gateway_request.created_at desc
  limit 1;
$$;

revoke all on function public.get_gateway_request_observability(uuid, text)
  from public, anon;
grant execute on function public.get_gateway_request_observability(uuid, text)
  to authenticated, service_role;

comment on function public.get_gateway_request_observability(uuid, text) is
  'Returns one authoritative gateway request enriched with normalized, metadata-only observability extensions.';

-- Reconcile all analytical projections after filling the historical gap. The
-- dataset is bounded to existing request facts and the processor is idempotent.
select public.refresh_v2_analytics_range(
  min(fact.occurred_at),
  now() + interval '1 second',
  null
)
from public.v2_request_facts fact;
