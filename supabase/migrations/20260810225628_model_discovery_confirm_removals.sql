-- Require two consecutive successful provider checks before treating a model
-- as removed. A model that reappears on the next check is never announced as
-- removed or newly added again.

alter table if exists public.model_discovery_seen_models
  add column if not exists removal_pending boolean not null default false;
