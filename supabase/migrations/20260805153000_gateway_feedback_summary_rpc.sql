-- Aggregate workspace feedback in Postgres so summaries remain complete beyond
-- PostgREST's per-request row ceiling and raw feedback never has to be loaded
-- into a Worker merely to calculate counts.
create or replace function public.gateway_feedback_summary(
  p_workspace_id uuid,
  p_group_by text default 'preset_id',
  p_metadata_key text default null,
  p_request_id text default null,
  p_session_id text default null,
  p_preset_id uuid default null,
  p_test_run_id uuid default null,
  p_created_since timestamptz default null,
  p_created_until timestamptz default null,
  p_metadata_filters jsonb default '{}'::jsonb,
  p_limit integer default 5000
)
returns table (
  group_value text,
  count bigint,
  positive bigint,
  negative bigint,
  partial bigint,
  average_score numeric,
  ratings jsonb,
  last_feedback_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_group_by not in ('preset_id', 'test_run_id', 'metadata') then
    raise exception 'invalid feedback summary grouping'
      using errcode = '22023';
  end if;

  if p_group_by = 'metadata'
     and (p_metadata_key is null or p_metadata_key !~ '^[a-zA-Z0-9_.:-]{1,64}$') then
    raise exception 'valid metadata key required for metadata grouping'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_metadata_filters, '{}'::jsonb)) <> 'object' then
    raise exception 'metadata filters must be a JSON object'
      using errcode = '22023';
  end if;

  return query
  with filtered as (
    select
      case p_group_by
        when 'preset_id' then feedback.preset_id::text
        when 'test_run_id' then feedback.test_run_id::text
        when 'metadata' then feedback.metadata_dimensions ->> p_metadata_key
      end as summary_group,
      feedback.rating,
      feedback.score,
      feedback.created_at
    from public.gateway_feedback as feedback
    where feedback.workspace_id = p_workspace_id
      and (p_request_id is null or feedback.request_id = p_request_id)
      and (p_session_id is null or feedback.session_id = p_session_id)
      and (p_preset_id is null or feedback.preset_id = p_preset_id)
      and (p_test_run_id is null or feedback.test_run_id = p_test_run_id)
      and (p_created_since is null or feedback.created_at >= p_created_since)
      and (p_created_until is null or feedback.created_at <= p_created_until)
      and feedback.metadata_dimensions @> coalesce(p_metadata_filters, '{}'::jsonb)
  ),
  grouped as (
    select
      filtered.summary_group,
      count(*) as feedback_count,
      count(*) filter (where filtered.rating in ('thumbs_up', 'correct')) as positive_count,
      count(*) filter (where filtered.rating in ('thumbs_down', 'incorrect', 'unsafe')) as negative_count,
      count(*) filter (where filtered.rating = 'partly_correct') as partial_count,
      avg(filtered.score) filter (where filtered.score is not null) as mean_score,
      max(filtered.created_at) as latest_feedback_at
    from filtered
    where filtered.summary_group is not null
      and filtered.summary_group <> ''
    group by filtered.summary_group
  ),
  rating_counts as (
    select
      filtered.summary_group,
      coalesce(filtered.rating, 'unrated') as rating_key,
      count(*) as rating_count
    from filtered
    where filtered.summary_group is not null
      and filtered.summary_group <> ''
    group by filtered.summary_group, coalesce(filtered.rating, 'unrated')
  ),
  rating_totals as (
    select
      rating_counts.summary_group,
      jsonb_object_agg(rating_counts.rating_key, rating_counts.rating_count) as rating_map
    from rating_counts
    group by rating_counts.summary_group
  )
  select
    grouped.summary_group,
    grouped.feedback_count,
    grouped.positive_count,
    grouped.negative_count,
    grouped.partial_count,
    grouped.mean_score,
    coalesce(rating_totals.rating_map, '{}'::jsonb),
    grouped.latest_feedback_at
  from grouped
  left join rating_totals using (summary_group)
  order by grouped.latest_feedback_at desc, grouped.summary_group asc
  limit greatest(1, least(coalesce(p_limit, 5000), 10000));
end;
$$;

revoke all on function public.gateway_feedback_summary(
  uuid, text, text, text, text, uuid, uuid, timestamptz, timestamptz, jsonb, integer
) from public;
revoke all on function public.gateway_feedback_summary(
  uuid, text, text, text, text, uuid, uuid, timestamptz, timestamptz, jsonb, integer
) from anon;
revoke all on function public.gateway_feedback_summary(
  uuid, text, text, text, text, uuid, uuid, timestamptz, timestamptz, jsonb, integer
) from authenticated;
grant execute on function public.gateway_feedback_summary(
  uuid, text, text, text, text, uuid, uuid, timestamptz, timestamptz, jsonb, integer
) to service_role;

comment on function public.gateway_feedback_summary(
  uuid, text, text, text, text, uuid, uuid, timestamptz, timestamptz, jsonb, integer
) is
  'Service-role-only, workspace-scoped feedback aggregation by preset, test run, or indexed metadata dimension.';
