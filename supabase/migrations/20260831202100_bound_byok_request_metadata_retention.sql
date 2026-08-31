-- phaseo:allow-destructive-migration reason: removes BYOK request-level metadata after the published 90-day access window; durable aggregate rollups remain

create or replace function public.prune_byok_request_metadata(
  p_retention_days integer default 90,
  p_batch_size integer default 10000
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cutoff timestamptz;
  v_v2_deleted integer := 0;
  v_legacy_deleted integer := 0;
begin
  if p_retention_days < 90 or p_retention_days > 3650 then
    raise exception 'BYOK metadata retention must be between 90 and 3650 days';
  end if;
  if p_batch_size < 1 or p_batch_size > 50000 then
    raise exception 'BYOK metadata prune batch size must be between 1 and 50000';
  end if;

  v_cutoff := now() - make_interval(days => p_retention_days);

  with candidates as (
    select facts.request_event_id
    from public.v2_request_facts facts
    where (
        facts.byok is true
        or exists (
          select 1
          from public.v2_request_attempts attempt
          where attempt.request_event_id = facts.request_event_id
            and attempt.safe_metadata->>'key_source' = 'byok'
        )
      )
      and facts.occurred_at < v_cutoff
    order by facts.occurred_at, facts.request_event_id
    limit p_batch_size
  )
  delete from public.v2_request_facts facts
  using candidates
  where facts.request_event_id = candidates.request_event_id;
  get diagnostics v_v2_deleted = row_count;

  with candidates as (
    select requests.id, requests.created_at
    from public.gateway_requests requests
    where (
        requests.byok is true
        or exists (
          select 1
          from public.gateway_upstream_requests attempt
          where attempt.gateway_request_id = requests.id
            and attempt.gateway_request_created_at = requests.created_at
            and attempt.key_source = 'byok'
        )
      )
      and requests.created_at < v_cutoff
    order by requests.created_at, requests.id
    limit p_batch_size
  )
  delete from public.gateway_requests requests
  using candidates
  where requests.id = candidates.id
    and requests.created_at = candidates.created_at;
  get diagnostics v_legacy_deleted = row_count;

  return jsonb_build_object(
    'cutoff', v_cutoff,
    'v2_deleted', v_v2_deleted,
    'legacy_deleted', v_legacy_deleted
  );
end;
$$;

revoke all on function public.prune_byok_request_metadata(integer, integer)
  from public, anon, authenticated;
grant execute on function public.prune_byok_request_metadata(integer, integer)
  to service_role;

comment on function public.prune_byok_request_metadata(integer, integer) is
  'Deletes bounded batches of BYOK request-level metadata older than 90 days or an explicitly longer operator-selected window. Child request facts are removed by cascade; aggregate rollups remain.';

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'prune-byok-request-metadata';

    perform cron.schedule(
      'prune-byok-request-metadata',
      '17 * * * *',
      $job$select public.prune_byok_request_metadata(90, 10000);$job$
    );
  end if;
end;
$$;
