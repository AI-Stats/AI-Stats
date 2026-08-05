-- Make the public rollup safe to retry and safe if cron invocations overlap.
create or replace function public.refresh_public_model_task_daily(
  p_since date default (current_date - 1)
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('refresh_public_model_task_daily')
  );

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

revoke all on function public.refresh_public_model_task_daily(date) from public, anon, authenticated;
grant execute on function public.refresh_public_model_task_daily(date) to service_role;
