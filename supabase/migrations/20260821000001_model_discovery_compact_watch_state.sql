-- Slim model discovery state so watchers keep only what change detection needs.
-- Full provider API payloads are replaced by a compact per-model watch snapshot,
-- and official pricing-page content moves into a dedicated state table.

alter table if exists public.model_discovery_seen_models
  add column if not exists watch_snapshot jsonb;

-- Release the raw payload storage; the columns remain only so older readers
-- that select them keep working until they are updated.
alter table if exists public.model_discovery_seen_models
  alter column model_details drop default,
  alter column model_details drop not null;

update public.model_discovery_seen_models
set model_details = null,
    pricing_details = null;

create table if not exists public.model_discovery_pricing_pages (
  provider_id text not null,
  source_url text not null,
  fingerprint text not null,
  content_lines jsonb not null default '[]'::jsonb,
  updated_at timestamp with time zone not null default (now() at time zone 'utc'::text),
  constraint model_discovery_pricing_pages_pkey primary key (provider_id)
);

-- These server-side diff helpers reference the removed payloads and have no callers.
drop function if exists public.compare_model_discovery_snapshot(text[], text[], jsonb);
drop function if exists public.commit_model_discovery_snapshot(uuid, text[], jsonb);
