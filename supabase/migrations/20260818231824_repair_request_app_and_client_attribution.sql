-- Keep gateway_requests, the authoritative request-log table, aligned with the
-- normalized attribution stored on the corresponding v2 request fact.
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

  update public.gateway_requests request
  set detail_metadata = coalesce(request.detail_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'client_source', new.safe_metadata->'client_source',
      'request', coalesce(request.detail_metadata->'request', '{}'::jsonb)
        || jsonb_build_object('user_agent', new.user_agent)
    )
  where request.id = new.gateway_request_id
    and request.created_at = new.gateway_request_created_at;

  return new;
end;
$$;

revoke all on function public.attach_v2_request_fact_to_gateway_request()
  from public, anon, authenticated;
grant execute on function public.attach_v2_request_fact_to_gateway_request()
  to service_role;

-- Repair existing request-log rows that predate the synchronized write path.
update public.gateway_requests request
set detail_metadata = coalesce(request.detail_metadata, '{}'::jsonb)
  || jsonb_build_object(
    'client_source', fact.safe_metadata->'client_source',
    'request', coalesce(request.detail_metadata->'request', '{}'::jsonb)
      || jsonb_build_object('user_agent', fact.user_agent)
  )
from public.v2_request_facts fact
where fact.gateway_request_id = request.id
  and fact.gateway_request_created_at = request.created_at
  and fact.safe_metadata->'client_source' is not null;

-- A workspace app is user-defined attribution. Requests with no explicit app
-- identity must not be assigned the synthetic about:blank app.
update public.gateway_requests request
set app_id = null
from public.api_apps app
where request.app_id = app.id
  and app.app_key = 'about:blank';

update public.v2_request_facts fact
set app_id = null
from public.api_apps app
where fact.app_id = app.id
  and app.app_key = 'about:blank';

update public.api_apps
set is_active = false,
    updated_at = now()
where app_key = 'about:blank';
