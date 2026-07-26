-- Expose only the explicitly safe request metadata recorded in V2 facts.
-- Raw prompts, completions, provider payloads, and tool I/O remain outside
-- Supabase and are never introduced by this projection.
create or replace view public.v2_web_gateway_requests
with (security_invoker = true) as
select
  request_row.*,
  fact.safe_metadata->'error_payload' as error_payload,
  fact.safe_metadata as detail_metadata
from public.v2_rpc_gateway_requests_legacy_shape request_row
join public.v2_request_facts fact on fact.request_event_id = request_row.id;

grant select on public.v2_web_gateway_requests to anon, authenticated, service_role;
