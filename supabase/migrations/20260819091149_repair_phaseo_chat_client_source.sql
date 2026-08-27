-- Phaseo Chat is App attribution, not a technical client source. Requests made
-- through the Chat proxy are ordinary HTTP traffic from the gateway's point of
-- view, so repair the incorrectly declared source while preserving app_id.
update public.v2_request_facts
set safe_metadata = jsonb_set(
  coalesce(safe_metadata, '{}'::jsonb),
  '{client_source}',
  jsonb_build_object(
    'id', 'api',
    'name', 'Direct API',
    'kind', 'api',
    'version', null,
    'detection', 'unknown'
  ),
  true
)
where client_source_id = 'phaseo-chat';

update public.gateway_requests
set detail_metadata = jsonb_set(
  coalesce(detail_metadata, '{}'::jsonb),
  '{client_source}',
  jsonb_build_object(
    'id', 'api',
    'name', 'Direct API',
    'kind', 'api',
    'version', null,
    'detection', 'unknown'
  ),
  true
)
where client_source_id = 'phaseo-chat';
