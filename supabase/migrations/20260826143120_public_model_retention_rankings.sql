-- phaseo:allow-destructive-migration reason: Rebuilds a bounded derived workspace rollup from authoritative request facts.
-- Public model return-rate rankings use one consistent identity unit: a Phaseo workspace.

create table if not exists public.public_model_workspace_usage_weekly (
  week_start date not null,
  model_id text not null,
  workspace_hash text not null,
  requests bigint not null default 0,
  refreshed_at timestamptz not null default now(),
  constraint public_model_workspace_usage_weekly_pkey primary key (week_start, model_id, workspace_hash)
);

create index if not exists public_model_workspace_usage_weekly_model_week_idx
  on public.public_model_workspace_usage_weekly (model_id, week_start desc);

alter table public.public_model_workspace_usage_weekly enable row level security;
revoke all on table public.public_model_workspace_usage_weekly from public, anon, authenticated;

comment on table public.public_model_workspace_usage_weekly is
  'Internal privacy-safe workspace activity used to aggregate public model return rates.';

create or replace function public.refresh_public_model_workspace_usage_weekly(
  p_since timestamptz default (now() - interval '12 weeks'),
  p_until timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_since_week date := date_trunc('week', p_since at time zone 'utc')::date;
  v_until_week date := date_trunc('week', p_until at time zone 'utc')::date;
begin
  delete from public.public_model_workspace_usage_weekly usage
  where usage.week_start >= v_since_week and usage.week_start <= v_until_week;

  insert into public.public_model_workspace_usage_weekly (
    week_start, model_id, workspace_hash, requests, refreshed_at
  )
  select
    date_trunc('week', fact.occurred_at at time zone 'utc')::date,
    coalesce(nullif(fact.routed_model_slug, ''), nullif(fact.requested_model_slug, '')),
    md5('public-model-workspace:' || fact.workspace_id::text),
    count(*)::bigint,
    now()
  from public.v2_request_facts fact
  where fact.occurred_at >= p_since
    and fact.occurred_at < p_until
    and fact.success is true
    and fact.workspace_id is not null
    and coalesce(nullif(fact.routed_model_slug, ''), nullif(fact.requested_model_slug, '')) is not null
    and lower(coalesce(nullif(fact.routed_model_slug, ''), nullif(fact.requested_model_slug, '')))
      not in ('unknown', 'other')
  group by 1, 2, 3;
end;
$function$;

revoke all on function public.refresh_public_model_workspace_usage_weekly(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.refresh_public_model_workspace_usage_weekly(timestamptz, timestamptz)
  to service_role;

create or replace function public.get_public_model_retention_rankings(
  p_weeks integer default 10,
  p_limit integer default 20,
  p_min_workspace_weeks integer default 25,
  p_min_workspaces integer default 5,
  p_min_weeks integer default 2
)
returns table (
  model_id text,
  retention_rate numeric,
  returning_workspace_weeks bigint,
  workspace_weeks bigint,
  unique_workspaces bigint,
  weeks_observed integer,
  confidence_low numeric,
  confidence_high numeric,
  first_cohort_week date,
  last_cohort_week date,
  rank integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select date_trunc('week', now() at time zone 'utc')::date as current_week,
      greatest(1, least(coalesce(p_weeks, 10), 52))::integer as requested_weeks
  ),
  eligible_transitions as (
    select cohort.week_start as cohort_week, cohort.model_id, cohort.workspace_hash,
      (returned.workspace_hash is not null) as returned
    from public.public_model_workspace_usage_weekly cohort
    cross join bounds
    left join public.public_model_workspace_usage_weekly returned
      on returned.week_start = cohort.week_start + 7
     and returned.model_id = cohort.model_id
     and returned.workspace_hash = cohort.workspace_hash
    where cohort.week_start >= bounds.current_week - (bounds.requested_weeks + 1) * interval '1 week'
      and cohort.week_start < bounds.current_week - interval '1 week'
  ),
  aggregated as (
    select transition.model_id,
      count(*)::bigint as workspace_weeks,
      count(*) filter (where transition.returned)::bigint as returning_workspace_weeks,
      count(distinct transition.workspace_hash)::bigint as unique_workspaces,
      count(distinct transition.cohort_week)::integer as weeks_observed,
      min(transition.cohort_week)::date as first_cohort_week,
      max(transition.cohort_week)::date as last_cohort_week
    from eligible_transitions transition
    group by transition.model_id
    having count(*) >= greatest(1, coalesce(p_min_workspace_weeks, 25))
      and count(distinct transition.workspace_hash) >= greatest(1, coalesce(p_min_workspaces, 5))
      and count(distinct transition.cohort_week) >= greatest(1, coalesce(p_min_weeks, 2))
  ),
  scored as (
    select aggregate.*,
      aggregate.returning_workspace_weeks::numeric / nullif(aggregate.workspace_weeks, 0) as rate,
      1.96::numeric as z
    from aggregated aggregate
  ),
  confidence as (
    select scored.*,
      (scored.rate + scored.z * scored.z / (2 * scored.workspace_weeks))
        / (1 + scored.z * scored.z / scored.workspace_weeks) as centre,
      scored.z * sqrt(
        (scored.rate * (1 - scored.rate) + scored.z * scored.z / (4 * scored.workspace_weeks))
        / scored.workspace_weeks
      ) / (1 + scored.z * scored.z / scored.workspace_weeks) as margin
    from scored
  ),
  ranked as (
    select confidence.*,
      row_number() over (
        order by confidence.rate desc, confidence.workspace_weeks desc, confidence.model_id
      )::integer as position
    from confidence
  )
  select ranked.model_id, round(ranked.rate * 100, 1), ranked.returning_workspace_weeks,
    ranked.workspace_weeks, ranked.unique_workspaces, ranked.weeks_observed,
    round(greatest(0, ranked.centre - ranked.margin) * 100, 1),
    round(least(1, ranked.centre + ranked.margin) * 100, 1),
    ranked.first_cohort_week, ranked.last_cohort_week, ranked.position
  from ranked
  order by ranked.position
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.get_public_model_retention_rankings(integer, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_public_model_retention_rankings(integer, integer, integer, integer, integer)
  to service_role;

comment on function public.get_public_model_retention_rankings(integer, integer, integer, integer, integer) is
  'Ranks canonical models by the share of Phaseo workspaces returning in the following completed UTC week.';

do $$
declare
  v_job_id bigint;
begin
  if to_regclass('cron.job') is null then return; end if;
  select jobid into v_job_id from cron.job
  where jobname = 'refresh-public-model-workspace-usage-weekly' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'refresh-public-model-workspace-usage-weekly',
    '17 * * * *',
    $sql$select public.refresh_public_model_workspace_usage_weekly(now() - interval '12 weeks', now());$sql$
  );
exception when others then null;
end $$;

select public.refresh_public_model_workspace_usage_weekly(now() - interval '12 weeks', now());
