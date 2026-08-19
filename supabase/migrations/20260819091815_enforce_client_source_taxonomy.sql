-- Client source identifies the request surface (SDK, agent SDK, HTTP client,
-- or direct API). Product applications belong in app attribution instead.
alter table public.v2_request_facts
  drop constraint if exists v2_request_facts_client_source_kind_check,
  add constraint v2_request_facts_client_source_kind_check check (
    client_source_kind is null or client_source_kind in (
      'sdk', 'agent_sdk', 'coding_agent', 'http_client', 'api', 'unknown'
    )
  ),
  drop constraint if exists v2_request_facts_client_source_id_not_app_check,
  add constraint v2_request_facts_client_source_id_not_app_check check (
    client_source_id is null or client_source_id <> 'phaseo-chat'
  );

alter table public.gateway_requests
  drop constraint if exists gateway_requests_client_source_kind_check,
  add constraint gateway_requests_client_source_kind_check check (
    client_source_kind is null or client_source_kind in (
      'sdk', 'agent_sdk', 'coding_agent', 'http_client', 'api', 'unknown'
    )
  ),
  drop constraint if exists gateway_requests_client_source_detection_check,
  add constraint gateway_requests_client_source_detection_check check (
    client_source_detection is null or client_source_detection in (
      'declared', 'user_agent', 'unknown'
    )
  ),
  drop constraint if exists gateway_requests_client_source_id_not_app_check,
  add constraint gateway_requests_client_source_id_not_app_check check (
    client_source_id is null or client_source_id <> 'phaseo-chat'
  );
