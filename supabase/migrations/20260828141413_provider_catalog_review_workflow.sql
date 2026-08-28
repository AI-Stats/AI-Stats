-- Review-gated provider catalog revisions.
--
-- A valid provider refresh is an immutable review revision. Reviewers decide
-- each provider/model claim independently; route publication remains separate.

alter table public.provider_catalog_sync_runs
  add column if not exists review_status text not null default 'pending',
  add column if not exists review_summary jsonb not null default '{}'::jsonb,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.provider_catalog_sync_runs
  drop constraint if exists provider_catalog_sync_runs_review_status_check;
alter table public.provider_catalog_sync_runs
  add constraint provider_catalog_sync_runs_review_status_check
  check (review_status in ('pending', 'in_progress', 'approved', 'partially_approved', 'rejected', 'needs_changes'));

create index if not exists provider_catalog_sync_runs_review_idx
  on public.provider_catalog_sync_runs (review_status, created_at desc);

create table if not exists public.provider_catalog_sync_models (
  run_id uuid not null references public.provider_catalog_sync_runs(id) on delete cascade,
  provider_slug text not null references public.v2_providers(provider_slug) on delete cascade,
  model_slug text not null,
  provider_model_slug text not null,
  name text not null,
  description text,
  input_modalities text[] not null default '{}'::text[],
  output_modalities text[] not null default '{}'::text[],
  context_length integer,
  max_output_tokens integer,
  decision text not null default 'pending',
  decision_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (run_id, model_slug),
  constraint provider_catalog_sync_models_decision_check
    check (decision in ('pending', 'approved', 'rejected', 'needs_changes')),
  constraint provider_catalog_sync_models_context_check
    check (context_length is null or context_length > 0),
  constraint provider_catalog_sync_models_output_check
    check (max_output_tokens is null or max_output_tokens > 0),
  constraint provider_catalog_sync_models_reason_check
    check (decision in ('pending', 'approved') or nullif(trim(decision_reason), '') is not null)
);

create index if not exists provider_catalog_sync_models_review_idx
  on public.provider_catalog_sync_models (provider_slug, decision, created_at desc);

create table if not exists public.provider_catalog_sync_model_capabilities (
  run_id uuid not null,
  model_slug text not null,
  capability_id text not null,
  parameters text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  primary key (run_id, model_slug, capability_id),
  foreign key (run_id, model_slug)
    references public.provider_catalog_sync_models(run_id, model_slug)
    on delete cascade
);

create table if not exists public.provider_catalog_review_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.provider_catalog_sync_runs(id) on delete cascade,
  model_slug text not null,
  decision text not null,
  reason text,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint provider_catalog_review_events_decision_check
    check (decision in ('approved', 'rejected', 'needs_changes')),
  constraint provider_catalog_review_events_reason_check
    check (decision = 'approved' or nullif(trim(reason), '') is not null)
);

create index if not exists provider_catalog_review_events_run_idx
  on public.provider_catalog_review_events (run_id, created_at desc);

-- Extend the existing atomic snapshot function to also persist the full
-- revision being reviewed. The latest observed snapshot remains separate from
-- the immutable decision records below.
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

    insert into public.provider_catalog_sync_models (
      run_id, provider_slug, model_slug, provider_model_slug, name, description,
      input_modalities, output_modalities, context_length, max_output_tokens
    ) values (
      p_run_id,
      p_provider_slug,
      model_slug_value,
      coalesce(nullif(model ->> 'providerModelSlug', ''), model_slug_value),
      coalesce(nullif(model ->> 'name', ''), model_slug_value),
      nullif(model ->> 'description', ''),
      coalesce(array(select jsonb_array_elements_text(model -> 'inputModalities')), '{}'::text[]),
      coalesce(array(select jsonb_array_elements_text(model -> 'outputModalities')), '{}'::text[]),
      nullif(model ->> 'contextLength', '')::integer,
      nullif(model ->> 'maxOutputTokens', '')::integer
    )
    on conflict (run_id, model_slug) do nothing;

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

      insert into public.provider_catalog_sync_model_capabilities (
        run_id, model_slug, capability_id, parameters
      ) values (
        p_run_id,
        model_slug_value,
        capability_id_value,
        coalesce(array(select jsonb_array_elements_text(capability -> 'parameters')), '{}'::text[])
      )
      on conflict (run_id, model_slug, capability_id) do nothing;

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

revoke all on public.provider_catalog_sync_models from anon, authenticated;
revoke all on public.provider_catalog_sync_model_capabilities from anon, authenticated;
revoke all on public.provider_catalog_review_events from anon, authenticated;
revoke all on function public.apply_provider_catalog_snapshot(text, uuid, jsonb) from public;
grant execute on function public.apply_provider_catalog_snapshot(text, uuid, jsonb) to service_role;

alter table public.provider_catalog_sync_models enable row level security;
alter table public.provider_catalog_sync_model_capabilities enable row level security;
alter table public.provider_catalog_review_events enable row level security;

comment on table public.provider_catalog_sync_models is
  'Immutable per-refresh provider/model claims awaiting reviewer decisions.';
comment on table public.provider_catalog_review_events is
  'Append-only audit history for provider catalog review decisions.';
