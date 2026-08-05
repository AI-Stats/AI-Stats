-- Opt-in request/response contribution, asynchronous classification, and
-- privacy-preserving aggregate usage intelligence.

alter table public.workspace_settings
  add column if not exists data_contribution_enabled boolean not null default false,
  add column if not exists data_contribution_policy_version text,
  add column if not exists data_contribution_consented_at timestamptz,
  add column if not exists data_contribution_consented_by uuid references auth.users(id) on delete set null,
  add column if not exists data_contribution_sample_rate_bps integer not null default 10000,
  add column if not exists data_contribution_classifier_sample_rate_bps integer not null default 1000,
  add column if not exists data_contribution_discount_bps integer not null default 100;

alter table public.workspace_settings
  drop constraint if exists workspace_settings_data_contribution_sample_rate_check,
  add constraint workspace_settings_data_contribution_sample_rate_check
    check (data_contribution_sample_rate_bps between 0 and 10000),
  drop constraint if exists workspace_settings_data_contribution_classifier_sample_rate_check,
  add constraint workspace_settings_data_contribution_classifier_sample_rate_check
    check (data_contribution_classifier_sample_rate_bps between 0 and 10000),
  drop constraint if exists workspace_settings_data_contribution_discount_check,
  add constraint workspace_settings_data_contribution_discount_check
    check (data_contribution_discount_bps between 0 and 10000),
  drop constraint if exists workspace_settings_data_contribution_consent_check,
  add constraint workspace_settings_data_contribution_consent_check check (
    not data_contribution_enabled or (
      data_contribution_policy_version is not null
      and data_contribution_consented_at is not null
    )
  );

comment on column public.workspace_settings.data_contribution_enabled is
  'Explicit workspace opt-in to contribute a deterministic sample of prompts and completions for a billing discount.';
comment on column public.workspace_settings.data_contribution_sample_rate_bps is
  'Deterministic redacted I/O retention rate in basis points. Platform controlled; initially 10000 (100%).';
comment on column public.workspace_settings.data_contribution_classifier_sample_rate_bps is
  'Independent upstream classifier submission rate in basis points. Platform controlled; initially 1000 (10%).';
comment on column public.workspace_settings.data_contribution_discount_bps is
  'Discount applied to eligible non-BYOK request charges in basis points. Platform controlled; initially 100 (1%).';

create index if not exists workspace_settings_data_contribution_actor_idx
  on public.workspace_settings (data_contribution_consented_by)
  where data_contribution_consented_by is not null;

create table if not exists public.data_contribution_consent_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_type text not null check (actor_type in ('user', 'management_key', 'system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_key_id uuid,
  action text not null check (action in ('enabled', 'disabled', 'change_denied')),
  outcome text not null check (outcome in ('succeeded', 'denied', 'failed')),
  policy_version text not null,
  sample_rate_bps integer not null check (sample_rate_bps between 0 and 10000),
  classifier_sample_rate_bps integer not null check (classifier_sample_rate_bps between 0 and 10000),
  discount_bps integer not null check (discount_bps between 0 and 10000),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists data_contribution_consent_workspace_created_idx
  on public.data_contribution_consent_events (workspace_id, created_at desc);
create index if not exists data_contribution_consent_actor_user_idx
  on public.data_contribution_consent_events (actor_user_id, created_at desc)
  where actor_user_id is not null;

create table if not exists public.workspace_classifiers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  kind text not null default 'custom' check (kind in ('openrouter_task', 'custom')),
  instructions text not null,
  categories jsonb not null,
  model text not null default 'gpt-5-mini',
  service_tier text not null default 'flex' check (service_tier in ('standard', 'flex')),
  sample_rate_bps integer not null default 10000 check (sample_rate_bps between 0 and 10000),
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug),
  constraint workspace_classifiers_categories_object_check check (jsonb_typeof(categories) = 'object')
);

create index if not exists workspace_classifiers_workspace_enabled_idx
  on public.workspace_classifiers (workspace_id, enabled, created_at desc);
create index if not exists workspace_classifiers_created_by_idx
  on public.workspace_classifiers (created_by)
  where created_by is not null;

create table if not exists public.data_contributions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_id text not null,
  occurred_at timestamptz not null default now(),
  endpoint text not null,
  model_slug text not null,
  provider_slug text,
  object_key text not null,
  object_bytes integer not null check (object_bytes > 0),
  object_sha256 text not null,
  retention_until timestamptz not null,
  consent_policy_version text not null,
  sample_rate_bps integer not null check (sample_rate_bps between 0 and 10000),
  classifier_sample_rate_bps integer not null check (classifier_sample_rate_bps between 0 and 10000),
  sample_bucket integer not null check (sample_bucket between 0 and 9999),
  redaction_version text not null,
  redaction_count integer not null default 0 check (redaction_count >= 0),
  discount_bps integer not null check (discount_bps between 0 and 10000),
  discount_nanos bigint not null default 0 check (discount_nanos >= 0),
  input_tokens bigint check (input_tokens is null or input_tokens >= 0),
  output_tokens bigint check (output_tokens is null or output_tokens >= 0),
  status text not null default 'pending' check (status in ('retained', 'pending', 'processing', 'complete', 'failed', 'deleted')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, request_id)
);

create index if not exists data_contributions_claim_idx
  on public.data_contributions (available_at, occurred_at, id)
  where status in ('pending', 'failed');
create index if not exists data_contributions_stale_lease_idx
  on public.data_contributions (lease_expires_at, occurred_at, id)
  where status = 'processing';
create index if not exists data_contributions_workspace_created_idx
  on public.data_contributions (workspace_id, created_at desc);
create index if not exists data_contributions_retention_idx
  on public.data_contributions (retention_until)
  where status <> 'deleted';

create table if not exists public.request_classifications (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.data_contributions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classifier_id uuid not null references public.workspace_classifiers(id) on delete cascade,
  primary_category text not null,
  labels jsonb not null default '[]'::jsonb,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  model text not null,
  service_tier text not null,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now(),
  unique (contribution_id, classifier_id),
  constraint request_classifications_labels_array_check check (jsonb_typeof(labels) = 'array')
);

create index if not exists request_classifications_workspace_created_idx
  on public.request_classifications (workspace_id, created_at desc);
create index if not exists request_classifications_classifier_category_idx
  on public.request_classifications (classifier_id, primary_category, created_at desc);

create table if not exists public.request_classification_daily (
  usage_date date not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classifier_id uuid not null references public.workspace_classifiers(id) on delete cascade,
  primary_category text not null,
  model_slug text not null,
  provider_slug text not null default '',
  request_count bigint not null default 0 check (request_count >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  updated_at timestamptz not null default now(),
  primary key (usage_date, workspace_id, classifier_id, primary_category, model_slug, provider_slug)
);

create index if not exists request_classification_daily_workspace_date_idx
  on public.request_classification_daily (workspace_id, usage_date desc);
create index if not exists request_classification_daily_classifier_idx
  on public.request_classification_daily (classifier_id, usage_date desc);

create table if not exists public.public_model_task_daily (
  usage_date date not null,
  taxonomy_slug text not null,
  primary_category text not null,
  model_slug text not null,
  provider_slug text not null default '',
  workspace_count bigint not null default 0 check (workspace_count >= 0),
  request_count bigint not null default 0 check (request_count >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  updated_at timestamptz not null default now(),
  primary key (usage_date, taxonomy_slug, primary_category, model_slug, provider_slug)
);

create index if not exists public_model_task_daily_model_date_idx
  on public.public_model_task_daily (model_slug, usage_date desc);

alter table public.data_contribution_consent_events enable row level security;
alter table public.workspace_classifiers enable row level security;
alter table public.data_contributions enable row level security;
alter table public.request_classifications enable row level security;
alter table public.request_classification_daily enable row level security;
alter table public.public_model_task_daily enable row level security;

revoke all on public.data_contribution_consent_events from public, anon, authenticated;
revoke all on public.workspace_classifiers from public, anon, authenticated;
revoke all on public.data_contributions from public, anon, authenticated;
revoke all on public.request_classifications from public, anon, authenticated;
revoke all on public.request_classification_daily from public, anon, authenticated;
revoke all on public.public_model_task_daily from public, anon, authenticated;

grant select, insert on public.data_contribution_consent_events to service_role;
grant select, insert, update, delete on public.workspace_classifiers to service_role;
grant select, insert, update, delete on public.data_contributions to service_role;
grant select, insert, update, delete on public.request_classifications to service_role;
grant select, insert, update, delete on public.request_classification_daily to service_role;
grant select, insert, update, delete on public.public_model_task_daily to service_role;
grant select on public.public_model_task_daily to anon, authenticated;

drop policy if exists public_model_task_daily_cohort_read on public.public_model_task_daily;
create policy public_model_task_daily_cohort_read
  on public.public_model_task_daily
  for select
  to anon, authenticated
  using (workspace_count >= 5 and request_count >= 100);

create or replace function public.set_data_contribution_consent(
  p_workspace_id uuid,
  p_enabled boolean,
  p_actor_type text,
  p_actor_user_id uuid default null,
  p_actor_key_id uuid default null,
  p_reason text default null,
  p_policy_version text default '2026-07-26-v2',
  p_sample_rate_bps integer default 10000,
  p_classifier_sample_rate_bps integer default 1000,
  p_discount_bps integer default 100
)
returns public.workspace_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.workspace_settings%rowtype;
begin
  if p_actor_type not in ('user', 'management_key', 'system') then
    raise exception 'invalid actor type';
  end if;
  if p_sample_rate_bps not between 0 and 10000
    or p_classifier_sample_rate_bps not between 0 and 10000
    or p_discount_bps not between 0 and 10000 then
    raise exception 'invalid contribution rates';
  end if;

  insert into public.workspace_settings (
    workspace_id, data_contribution_enabled, data_contribution_policy_version,
    data_contribution_consented_at, data_contribution_consented_by,
    data_contribution_sample_rate_bps, data_contribution_classifier_sample_rate_bps,
    data_contribution_discount_bps, updated_at
  ) values (
    p_workspace_id, p_enabled, p_policy_version,
    case when p_enabled then now() else null end,
    case when p_enabled then p_actor_user_id else null end,
    p_sample_rate_bps, p_classifier_sample_rate_bps, p_discount_bps, now()
  )
  on conflict (workspace_id) do update set
    data_contribution_enabled = excluded.data_contribution_enabled,
    data_contribution_policy_version = excluded.data_contribution_policy_version,
    data_contribution_consented_at = excluded.data_contribution_consented_at,
    data_contribution_consented_by = excluded.data_contribution_consented_by,
    data_contribution_sample_rate_bps = excluded.data_contribution_sample_rate_bps,
    data_contribution_classifier_sample_rate_bps = excluded.data_contribution_classifier_sample_rate_bps,
    data_contribution_discount_bps = excluded.data_contribution_discount_bps,
    updated_at = excluded.updated_at
  returning * into v_settings;

  insert into public.data_contribution_consent_events (
    workspace_id, actor_type, actor_user_id, actor_key_id, action, outcome,
    policy_version, sample_rate_bps, classifier_sample_rate_bps, discount_bps, reason
  ) values (
    p_workspace_id, p_actor_type, p_actor_user_id, p_actor_key_id,
    case when p_enabled then 'enabled' else 'disabled' end,
    'succeeded', p_policy_version, p_sample_rate_bps, p_classifier_sample_rate_bps, p_discount_bps,
    left(p_reason, 500)
  );

  if not p_enabled then
    update public.data_contributions
    set retention_until = least(retention_until, now()),
        available_at = greatest(available_at, now()),
        updated_at = now()
    where workspace_id = p_workspace_id
      and status <> 'deleted';
  end if;

  return v_settings;
end;
$$;

revoke all on function public.set_data_contribution_consent(uuid, boolean, text, uuid, uuid, text, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.set_data_contribution_consent(uuid, boolean, text, uuid, uuid, text, text, integer, integer, integer) to service_role;

create or replace function public.claim_data_contributions(
  p_limit integer default 25,
  p_lease_seconds integer default 300
)
returns setof public.data_contributions
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select contribution.id
    from public.data_contributions contribution
    where (
      contribution.status in ('pending', 'failed')
      or (contribution.status = 'processing' and contribution.lease_expires_at <= now())
    )
      and contribution.available_at <= now()
      and contribution.retention_until > now()
    order by contribution.available_at, contribution.occurred_at, contribution.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 250))
  )
  update public.data_contributions contribution
  set status = 'processing',
      attempt_count = contribution.attempt_count + 1,
      lease_expires_at = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 300), 3600))),
      updated_at = now()
  from candidates
  where contribution.id = candidates.id
  returning contribution.*;
end;
$$;

revoke all on function public.claim_data_contributions(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_data_contributions(integer, integer) to service_role;

create or replace function public.get_data_contribution_totals(
  p_workspace_id uuid,
  p_since timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'contributions', count(*),
    'discount_nanos', coalesce(sum(contribution.discount_nanos), 0)
  )
  from public.data_contributions contribution
  where contribution.workspace_id = p_workspace_id
    and contribution.created_at >= p_since;
$$;

revoke all on function public.get_data_contribution_totals(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.get_data_contribution_totals(uuid, timestamptz) to service_role;

create or replace function public.refresh_request_classification_rollup(
  p_contribution_id uuid,
  p_classifier_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contribution public.data_contributions%rowtype;
  v_category text;
  v_classifier_kind text;
  v_classifier_slug text;
begin
  select * into strict v_contribution
  from public.data_contributions
  where id = p_contribution_id;

  select primary_category into strict v_category
  from public.request_classifications
  where contribution_id = p_contribution_id
    and classifier_id = p_classifier_id;

  select kind, slug into strict v_classifier_kind, v_classifier_slug
  from public.workspace_classifiers
  where id = p_classifier_id;

  insert into public.request_classification_daily (
    usage_date, workspace_id, classifier_id, primary_category, model_slug,
    provider_slug, request_count, input_tokens, output_tokens, updated_at
  )
  select
    contribution.occurred_at::date,
    contribution.workspace_id,
    classification.classifier_id,
    classification.primary_category,
    contribution.model_slug,
    coalesce(contribution.provider_slug, ''),
    count(*),
    coalesce(sum(contribution.input_tokens), 0),
    coalesce(sum(contribution.output_tokens), 0),
    now()
  from public.request_classifications classification
  join public.data_contributions contribution on contribution.id = classification.contribution_id
  where contribution.workspace_id = v_contribution.workspace_id
    and contribution.occurred_at::date = v_contribution.occurred_at::date
    and classification.classifier_id = p_classifier_id
    and classification.primary_category = v_category
    and contribution.model_slug = v_contribution.model_slug
    and coalesce(contribution.provider_slug, '') = coalesce(v_contribution.provider_slug, '')
  group by contribution.occurred_at::date, contribution.workspace_id,
    classification.classifier_id, classification.primary_category,
    contribution.model_slug, coalesce(contribution.provider_slug, '')
  on conflict (usage_date, workspace_id, classifier_id, primary_category, model_slug, provider_slug)
  do update set
    request_count = excluded.request_count,
    input_tokens = excluded.input_tokens,
    output_tokens = excluded.output_tokens,
    updated_at = excluded.updated_at;

  if v_classifier_kind = 'openrouter_task' then
    insert into public.public_model_task_daily (
      usage_date, taxonomy_slug, primary_category, model_slug, provider_slug,
      workspace_count, request_count, input_tokens, output_tokens, updated_at
    )
    select
      contribution.occurred_at::date,
      classifier.slug,
      classification.primary_category,
      contribution.model_slug,
      coalesce(contribution.provider_slug, ''),
      count(distinct contribution.workspace_id),
      count(*),
      coalesce(sum(contribution.input_tokens), 0),
      coalesce(sum(contribution.output_tokens), 0),
      now()
    from public.request_classifications classification
    join public.data_contributions contribution on contribution.id = classification.contribution_id
    join public.workspace_classifiers classifier on classifier.id = classification.classifier_id
    where contribution.occurred_at::date = v_contribution.occurred_at::date
      and classification.primary_category = v_category
      and contribution.model_slug = v_contribution.model_slug
      and coalesce(contribution.provider_slug, '') = coalesce(v_contribution.provider_slug, '')
      and classifier.kind = 'openrouter_task'
      and classifier.slug = v_classifier_slug
    group by contribution.occurred_at::date, classifier.slug, classification.primary_category,
      contribution.model_slug, coalesce(contribution.provider_slug, '')
    on conflict (usage_date, taxonomy_slug, primary_category, model_slug, provider_slug)
    do update set
      workspace_count = excluded.workspace_count,
      request_count = excluded.request_count,
      input_tokens = excluded.input_tokens,
      output_tokens = excluded.output_tokens,
      updated_at = excluded.updated_at;
  end if;
end;
$$;

revoke all on function public.refresh_request_classification_rollup(uuid, uuid) from public, anon, authenticated;
grant execute on function public.refresh_request_classification_rollup(uuid, uuid) to service_role;

comment on table public.data_contribution_consent_events is
  'Unsampled, content-free audit trail for contribution consent changes.';
comment on table public.data_contributions is
  'Service-only metadata and work queue. Prompt/completion content lives only in the dedicated R2 bucket.';
