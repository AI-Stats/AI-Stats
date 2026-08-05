-- Build the high-write telemetry index without blocking gateway ingestion.
create index concurrently if not exists v2_request_facts_model_stream_context_time_idx
  on public.v2_request_facts (
    coalesce(routed_model_slug, requested_model_slug),
    stream,
    occurred_at desc
  );
