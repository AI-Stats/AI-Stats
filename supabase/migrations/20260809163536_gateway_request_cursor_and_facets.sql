-- Stable keyset pagination for request logs. request_id is the deterministic
-- tie-breaker when multiple requests share the same timestamp.
create index if not exists gateway_requests_workspace_cursor_idx
  on public.gateway_requests (workspace_id, created_at desc, id desc);

-- Return filter facets without transferring raw request rows to the web tier.
-- RLS remains authoritative because this function is SECURITY INVOKER.
create or replace function public.get_gateway_request_facets(
  p_workspace_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  facet text,
  value text,
  value_label text,
  request_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with scoped as materialized (
    select
      gr.model_id,
      gr.provider,
      gr.app_id::text as app_id,
	  gr.key_id::text as key_id,
      gr.endpoint,
	  case when gr.stream then 'streaming' else 'non_streaming' end as stream_mode,
      gr.finish_reason,
      gr.error_code,
      gr.status_code::text as status_code,
      case when gr.success then 'success' else 'error' end as request_status,
      gr.client_source_id,
      gr.client_source_name
    from public.gateway_requests gr
    where gr.workspace_id = p_workspace_id
      and gr.created_at >= p_from
      and gr.created_at <= p_to
      and gr.endpoint not in ('video.generation', 'batch', 'music.generate')
  )
  select 'model', model_id, null::text, count(*) from scoped where model_id is not null group by model_id
  union all
  select 'provider', provider, null::text, count(*) from scoped where provider is not null group by provider
  union all
  select 'app', app_id, null::text, count(*) from scoped where app_id is not null group by app_id
  union all
	select 'key', key_id, null::text, count(*) from scoped where key_id is not null group by key_id
	union all
  select 'endpoint', endpoint, null::text, count(*) from scoped where endpoint is not null group by endpoint
  union all
	select 'stream', stream_mode, null::text, count(*) from scoped group by stream_mode
	union all
  select 'finish_reason', finish_reason, null::text, count(*) from scoped where finish_reason is not null group by finish_reason
  union all
  select 'error_code', error_code, null::text, count(*) from scoped where error_code is not null group by error_code
  union all
  select 'http_status', status_code, null::text, count(*) from scoped where status_code is not null group by status_code
  union all
  select 'status', request_status, null::text, count(*) from scoped group by request_status
  union all
  select 'source', client_source_id, max(client_source_name), count(*) from scoped where client_source_id is not null group by client_source_id;
$$;

revoke all on function public.get_gateway_request_facets(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_gateway_request_facets(uuid, timestamptz, timestamptz) to authenticated, service_role;

comment on function public.get_gateway_request_facets(uuid, timestamptz, timestamptz) is
  'Workspace/time-scoped exact request filter counts. Uses caller RLS and returns no raw request payloads.';
