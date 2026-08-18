-- Keep watcher state lookups on the small completed-run subset and satisfy
-- source-scoped ORDER BY/LIMIT reads without scanning recent run summaries.
create index if not exists model_discovery_runs_completed_source_started_at_idx
  on catalog.model_discovery_runs (source, started_at desc)
  where status in ('completed', 'completed_with_errors');
