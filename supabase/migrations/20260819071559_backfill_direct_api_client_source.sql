-- Rows created before client-source attribution was introduced have no source
-- metadata to recover. Treat them as direct API traffic so Logs display and
-- source filtering use the same explicit fallback.
update public.gateway_requests
set detail_metadata = coalesce(detail_metadata, '{}'::jsonb)
  || jsonb_build_object(
    'client_source',
    jsonb_build_object(
      'id', 'api',
      'name', 'Direct API',
      'kind', 'api',
      'version', null,
      'detection', 'unknown'
    )
  )
where client_source_id is null;
