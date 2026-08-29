-- Request labels are stored inside the existing queryable v2 metadata envelope.
-- Keep the index focused on metadata containment so analytics can filter by
-- one label without scanning every request fact in the workspace.
create index if not exists v2_request_facts_safe_metadata_gin_idx
  on public.v2_request_facts using gin (safe_metadata jsonb_path_ops);

comment on column public.v2_request_facts.safe_metadata is
  'Non-content metadata only. Includes optional request labels; prompt, completion, provider body, and tool I/O values are prohibited.';
