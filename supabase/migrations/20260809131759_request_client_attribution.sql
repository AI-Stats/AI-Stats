-- Promote sanitized client attribution into queryable request dimensions.
-- The gateway remains the sole normalizer; generated columns prevent the
-- database and UI from independently interpreting untrusted HTTP headers.

alter table public.v2_request_facts
  add column if not exists client_source_id text
    generated always as (nullif(safe_metadata #>> '{client_source,id}', '')) stored,
  add column if not exists client_source_name text
    generated always as (nullif(safe_metadata #>> '{client_source,name}', '')) stored,
  add column if not exists client_source_kind text
    generated always as (nullif(safe_metadata #>> '{client_source,kind}', '')) stored,
  add column if not exists client_source_version text
    generated always as (nullif(safe_metadata #>> '{client_source,version}', '')) stored,
  add column if not exists client_source_detection text
    generated always as (nullif(safe_metadata #>> '{client_source,detection}', '')) stored;

alter table public.v2_request_facts
  drop constraint if exists v2_request_facts_client_source_kind_check,
  add constraint v2_request_facts_client_source_kind_check check (
    client_source_kind is null or client_source_kind in (
      'sdk', 'agent_sdk', 'coding_agent', 'http_client', 'app', 'api', 'unknown'
    )
  ),
  drop constraint if exists v2_request_facts_client_source_detection_check,
  add constraint v2_request_facts_client_source_detection_check check (
    client_source_detection is null or client_source_detection in (
      'declared', 'user_agent', 'unknown'
    )
  );

create index if not exists v2_request_facts_workspace_client_source_time_idx
  on public.v2_request_facts (workspace_id, client_source_id, occurred_at desc)
  where client_source_id is not null;

alter table public.gateway_requests
  add column if not exists client_source_id text
    generated always as (nullif(detail_metadata #>> '{client_source,id}', '')) stored,
  add column if not exists client_source_name text
    generated always as (nullif(detail_metadata #>> '{client_source,name}', '')) stored,
  add column if not exists client_source_kind text
    generated always as (nullif(detail_metadata #>> '{client_source,kind}', '')) stored,
  add column if not exists client_source_version text
    generated always as (nullif(detail_metadata #>> '{client_source,version}', '')) stored,
  add column if not exists client_source_detection text
    generated always as (nullif(detail_metadata #>> '{client_source,detection}', '')) stored;

create index if not exists gateway_requests_workspace_client_source_time_idx
  on public.gateway_requests (workspace_id, client_source_id, created_at desc)
  where client_source_id is not null;

create or replace view public.v2_web_gateway_requests
with (security_invoker = true) as
select
  request_row.*,
  fact.safe_metadata->'error_payload' as error_payload,
  fact.safe_metadata as detail_metadata,
  fact.client_source_id,
  fact.client_source_name,
  fact.client_source_kind,
  fact.client_source_version,
  fact.client_source_detection
from public.v2_rpc_gateway_requests_legacy_shape request_row
join public.v2_request_facts fact on fact.request_event_id = request_row.id;

grant select on public.v2_web_gateway_requests to anon, authenticated, service_role;

comment on column public.v2_request_facts.client_source_id is
  'Gateway-normalized client identity such as codex, claude-code, or phaseo-typescript.';
comment on column public.v2_request_facts.client_source_detection is
  'Whether client identity was declared, inferred from user-agent, or unavailable.';
