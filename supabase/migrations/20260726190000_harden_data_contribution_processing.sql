-- Follow-up hardening for production environments where the base contribution
-- migration was applied before the gated Worker release.

alter table public.data_contribution_consent_events
  drop constraint if exists data_contribution_consent_events_workspace_id_fkey,
  add constraint data_contribution_consent_events_workspace_id_fkey
    foreign key (workspace_id) references public.workspaces(id) on delete cascade;

create index if not exists data_contributions_claimable_idx
  on public.data_contributions (
    (case when status = 'processing' then lease_expires_at else available_at end),
    occurred_at,
    id
  )
  where status in ('pending', 'failed', 'processing');

create index if not exists request_classification_daily_public_rollup_idx
  on public.request_classification_daily (
    usage_date, classifier_id, primary_category, model_slug, provider_slug, workspace_id
  )
  include (request_count, input_tokens, output_tokens);

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
    where contribution.status in ('pending', 'failed', 'processing')
      and case
        when contribution.status = 'processing' then contribution.lease_expires_at
        else contribution.available_at
      end <= now()
      and contribution.retention_until > now()
    order by
      case
        when contribution.status = 'processing' then contribution.lease_expires_at
        else contribution.available_at
      end,
      contribution.occurred_at,
      contribution.id
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
begin
  select * into v_contribution
  from public.data_contributions
  where id = p_contribution_id;
  if not found then return; end if;

  select primary_category into v_category
  from public.request_classifications
  where contribution_id = p_contribution_id
    and classifier_id = p_classifier_id;
  if not found then return; end if;

  if not exists (
    select 1 from public.workspace_classifiers where id = p_classifier_id
  ) then
    return;
  end if;

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
end;
$$;

create or replace function public.refresh_public_model_task_daily(
  p_since date default (current_date - 1)
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.public_model_task_daily
  where usage_date >= coalesce(p_since, current_date - 1);

  insert into public.public_model_task_daily (
    usage_date, taxonomy_slug, primary_category, model_slug, provider_slug,
    workspace_count, request_count, input_tokens, output_tokens, updated_at
  )
  select
    daily.usage_date,
    classifier.slug,
    daily.primary_category,
    daily.model_slug,
    daily.provider_slug,
    count(*) as workspace_count,
    sum(daily.request_count) as request_count,
    sum(daily.input_tokens) as input_tokens,
    sum(daily.output_tokens) as output_tokens,
    now()
  from public.request_classification_daily daily
  join public.workspace_classifiers classifier on classifier.id = daily.classifier_id
  where daily.usage_date >= coalesce(p_since, current_date - 1)
    and classifier.kind = 'openrouter_task'
  group by daily.usage_date, classifier.slug, daily.primary_category,
    daily.model_slug, daily.provider_slug
  on conflict (usage_date, taxonomy_slug, primary_category, model_slug, provider_slug)
  do update set
    workspace_count = excluded.workspace_count,
    request_count = excluded.request_count,
    input_tokens = excluded.input_tokens,
    output_tokens = excluded.output_tokens,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.claim_data_contributions(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_data_contributions(integer, integer) to service_role;
revoke all on function public.refresh_request_classification_rollup(uuid, uuid) from public, anon, authenticated;
grant execute on function public.refresh_request_classification_rollup(uuid, uuid) to service_role;
revoke all on function public.refresh_public_model_task_daily(date) from public, anon, authenticated;
grant execute on function public.refresh_public_model_task_daily(date) to service_role;
