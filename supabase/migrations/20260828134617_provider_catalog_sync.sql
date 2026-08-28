-- Provider catalog synchronization.
--
-- Webhooks provide low-latency refreshes, while scheduled polling remains the
-- reliability backstop. Every trigger passes through the same validation and
-- normalized snapshot writer; neither path enables public routing by itself.

create table if not exists public.provider_catalog_sources (
  provider_slug text primary key references public.v2_providers(provider_slug) on delete cascade,
  catalog_url text not null,
  status text not null default 'active',
  delivery_mode text not null default 'webhook_and_polling',
  poll_interval_seconds integer not null default 900,
  next_poll_at timestamptz not null default now(),
  last_polled_at timestamptz,
  last_success_at timestamptz,
  last_http_status integer,
  last_catalog_sha256 text,
  consecutive_failures integer not null default 0,
  last_error text,
  etag text,
  last_modified text,
  webhook_secret_ciphertext text,
  webhook_secret_iv text,
  webhook_secret_hash text,
  webhook_secret_version text not null default 'v1',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_catalog_sources_status_check
    check (status in ('active', 'paused', 'disabled')),
  constraint provider_catalog_sources_delivery_mode_check
    check (delivery_mode in ('polling', 'webhook_and_polling')),
  constraint provider_catalog_sources_poll_interval_check
    check (poll_interval_seconds between 60 and 86400),
  constraint provider_catalog_sources_failures_check
    check (consecutive_failures >= 0)
);

create index if not exists provider_catalog_sources_poll_idx
  on public.provider_catalog_sources (next_poll_at)
  where status = 'active';

create table if not exists public.provider_catalog_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider_slug text not null references public.v2_providers(provider_slug) on delete cascade,
  trigger text not null,
  external_event_id text,
  status text not null default 'processing',
  catalog_url text,
  catalog_sha256 text,
  model_count integer,
  model_preview jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint provider_catalog_sync_runs_trigger_check
    check (trigger in ('webhook', 'poll', 'manual')),
  constraint provider_catalog_sync_runs_status_check
    check (status in ('processing', 'not_modified', 'validated', 'applied', 'rejected', 'failed')),
  constraint provider_catalog_sync_runs_model_count_check
    check (model_count is null or model_count >= 0)
);

create unique index if not exists provider_catalog_sync_runs_event_idx
  on public.provider_catalog_sync_runs (provider_slug, external_event_id)
  where external_event_id is not null;
create index if not exists provider_catalog_sync_runs_provider_idx
  on public.provider_catalog_sync_runs (provider_slug, created_at desc);

create table if not exists public.provider_catalog_models (
  provider_slug text not null references public.v2_providers(provider_slug) on delete cascade,
  model_slug text not null,
  provider_model_slug text not null,
  name text not null,
  description text,
  input_modalities text[] not null default '{}'::text[],
  output_modalities text[] not null default '{}'::text[],
  context_length integer,
  max_output_tokens integer,
  status text not null default 'active',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  source_run_id uuid references public.provider_catalog_sync_runs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider_slug, model_slug),
  constraint provider_catalog_models_status_check
    check (status in ('active', 'removed')),
  constraint provider_catalog_models_context_check
    check (context_length is null or context_length > 0),
  constraint provider_catalog_models_output_check
    check (max_output_tokens is null or max_output_tokens > 0)
);

create index if not exists provider_catalog_models_status_idx
  on public.provider_catalog_models (provider_slug, status, model_slug);

create table if not exists public.provider_catalog_model_capabilities (
  provider_slug text not null,
  model_slug text not null,
  capability_id text not null,
  parameters text[] not null default '{}'::text[],
  status text not null default 'active',
  source_run_id uuid references public.provider_catalog_sync_runs(id) on delete set null,
  observed_at timestamptz not null default now(),
  primary key (provider_slug, model_slug, capability_id),
  foreign key (provider_slug, model_slug)
    references public.provider_catalog_models(provider_slug, model_slug)
    on delete cascade,
  constraint provider_catalog_model_capabilities_status_check
    check (status in ('active', 'removed'))
);

create index if not exists provider_catalog_model_capabilities_status_idx
  on public.provider_catalog_model_capabilities (provider_slug, status, capability_id);

-- The service-role Worker calls this invoker function after schema validation.
-- It atomically replaces the provider-owned observed snapshot and marks models
-- omitted from a full catalog as removed. It does not touch v2 routing tables.
create or replace function public.apply_provider_catalog_snapshot(
  p_provider_slug text,
  p_run_id uuid,
  p_models jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  model jsonb;
  capability jsonb;
  applied_count integer := 0;
  model_slug_value text;
  capability_id_value text;
begin
  update public.provider_catalog_models
  set status = 'removed', updated_at = now(), source_run_id = p_run_id
  where provider_slug = p_provider_slug
    and status = 'active'
    and not exists (
      select 1
      from jsonb_array_elements(p_models) as incoming(value)
      where incoming.value ->> 'id' = provider_catalog_models.model_slug
    );

  update public.provider_catalog_model_capabilities
  set status = 'removed', source_run_id = p_run_id, observed_at = now()
  where provider_slug = p_provider_slug;

  for model in select value from jsonb_array_elements(p_models)
  loop
    model_slug_value := model ->> 'id';

    insert into public.provider_catalog_models (
      provider_slug, model_slug, provider_model_slug, name, description,
      input_modalities, output_modalities, context_length, max_output_tokens,
      status, last_seen_at, source_run_id, metadata, updated_at
    ) values (
      p_provider_slug,
      model_slug_value,
      coalesce(nullif(model ->> 'providerModelSlug', ''), model_slug_value),
      coalesce(nullif(model ->> 'name', ''), model_slug_value),
      nullif(model ->> 'description', ''),
      coalesce(array(select jsonb_array_elements_text(model -> 'inputModalities')), '{}'::text[]),
      coalesce(array(select jsonb_array_elements_text(model -> 'outputModalities')), '{}'::text[]),
      nullif(model ->> 'contextLength', '')::integer,
      nullif(model ->> 'maxOutputTokens', '')::integer,
      'active', now(), p_run_id, '{}'::jsonb, now()
    )
    on conflict (provider_slug, model_slug) do update set
      provider_model_slug = excluded.provider_model_slug,
      name = excluded.name,
      description = excluded.description,
      input_modalities = excluded.input_modalities,
      output_modalities = excluded.output_modalities,
      context_length = excluded.context_length,
      max_output_tokens = excluded.max_output_tokens,
      status = 'active',
      last_seen_at = now(),
      source_run_id = excluded.source_run_id,
      updated_at = now();

    for capability in select value from jsonb_array_elements(coalesce(model -> 'capabilities', '[]'::jsonb))
    loop
      capability_id_value := capability ->> 'id';
      insert into public.provider_catalog_model_capabilities (
        provider_slug, model_slug, capability_id, parameters, status, source_run_id, observed_at
      ) values (
        p_provider_slug,
        model_slug_value,
        capability_id_value,
        coalesce(array(select jsonb_array_elements_text(capability -> 'parameters')), '{}'::text[]),
        'active', p_run_id, now()
      )
      on conflict (provider_slug, model_slug, capability_id) do update set
        parameters = excluded.parameters,
        status = 'active',
        source_run_id = excluded.source_run_id,
        observed_at = now();
    end loop;

    applied_count := applied_count + 1;
  end loop;

  return applied_count;
end;
$$;

revoke all on public.provider_catalog_sources from anon, authenticated;
revoke all on public.provider_catalog_sync_runs from anon, authenticated;
revoke all on public.provider_catalog_models from anon, authenticated;
revoke all on public.provider_catalog_model_capabilities from anon, authenticated;
revoke all on function public.apply_provider_catalog_snapshot(text, uuid, jsonb) from public;
grant execute on function public.apply_provider_catalog_snapshot(text, uuid, jsonb) to service_role;

alter table public.provider_catalog_sources enable row level security;
alter table public.provider_catalog_sync_runs enable row level security;
alter table public.provider_catalog_models enable row level security;
alter table public.provider_catalog_model_capabilities enable row level security;

comment on table public.provider_catalog_sources is
  'Provider-owned catalog source configuration with webhook and polling state.';
comment on table public.provider_catalog_sync_runs is
  'Idempotent catalog refresh attempts and validation outcomes.';
comment on table public.provider_catalog_models is
  'Normalized provider-reported model snapshot; not public route publication.';
