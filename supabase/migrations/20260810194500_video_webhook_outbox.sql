-- Make video lifecycle webhook delivery durable and keep per-job delivery
-- telemetry concurrency-safe.

alter table public.gateway_async_webhook_deliveries
  add column if not exists event_type text null,
  add column if not exists phase text null,
  add column if not exists progress double precision null,
  add column if not exists previous_status text null,
  add column if not exists current_status text null,
  add column if not exists next_attempt_at timestamptz null,
  add column if not exists last_error text null;

create index if not exists gateway_async_webhook_deliveries_pending_idx
  on public.gateway_async_webhook_deliveries (next_attempt_at, updated_at)
  where status = 'pending';

create or replace function public.enqueue_gateway_async_webhook_delivery(
  p_workspace_id uuid,
  p_kind text,
  p_internal_id text,
  p_delivery_key text,
  p_event_type text,
  p_phase text,
  p_progress double precision default null,
  p_previous_status text default null,
  p_current_status text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.gateway_async_webhook_deliveries (
    workspace_id, kind, internal_id, delivery_key, status,
    event_type, phase, progress, previous_status, current_status,
    next_attempt_at, updated_at
  ) values (
    p_workspace_id, p_kind, p_internal_id, p_delivery_key, 'pending',
    p_event_type, p_phase, p_progress, p_previous_status, p_current_status,
    now(), now()
  ) on conflict (workspace_id, kind, internal_id, delivery_key) do nothing;
$$;

create or replace function public.gateway_async_operation_video_webhook_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous text;
  v_current text := lower(coalesce(new.status, ''));
  v_terminal_phase text;
begin
  if new.kind <> 'video' then return new; end if;

  if tg_op = 'INSERT' then
    perform public.enqueue_gateway_async_webhook_delivery(
      new.workspace_id, new.kind, new.internal_id,
      'video.created', 'video.created', 'created', null, null, v_current
    );
    return new;
  end if;

  v_previous := lower(coalesce(old.status, ''));
  if v_previous = v_current then return new; end if;

  perform public.enqueue_gateway_async_webhook_delivery(
    new.workspace_id, new.kind, new.internal_id,
    'video.status_changed:' || coalesce(nullif(v_previous, ''), 'unknown') || ':' || coalesce(nullif(v_current, ''), 'unknown'),
    'video.status_changed', 'status_changed', null,
    nullif(v_previous, ''), nullif(v_current, '')
  );

  v_terminal_phase := case v_current
    when 'completed' then 'completed'
    when 'failed' then 'failed'
    when 'cancelled' then 'cancelled'
    when 'canceled' then 'cancelled'
    when 'expired' then 'expired'
    else null
  end;
  if v_terminal_phase is not null then
    perform public.enqueue_gateway_async_webhook_delivery(
      new.workspace_id, new.kind, new.internal_id,
      'video.' || v_terminal_phase,
      'video.' || v_terminal_phase,
      v_terminal_phase,
      null,
      nullif(v_previous, ''),
      nullif(v_current, '')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists gateway_async_operation_video_webhook_outbox
  on public.gateway_async_operations;
create trigger gateway_async_operation_video_webhook_outbox
after insert or update of status on public.gateway_async_operations
for each row execute function public.gateway_async_operation_video_webhook_outbox();

create or replace function public.record_gateway_async_webhook_result(
  p_workspace_id uuid,
  p_kind text,
  p_internal_id text,
  p_delivery_key text,
  p_attempt jsonb,
  p_retry_state jsonb default null,
  p_delivered_at timestamptz default null,
  p_next_retry_at timestamptz default null,
  p_progress double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb;
  v_attempts jsonb;
  v_queue jsonb;
  v_deliveries jsonb;
  v_next_retry_at timestamptz;
begin
  select coalesce(meta, '{}'::jsonb) into v_meta
  from public.gateway_async_operations
  where workspace_id = p_workspace_id and kind = p_kind and internal_id = p_internal_id
  for update;
  if not found then return; end if;

  v_attempts := coalesce(v_meta->'webhookAttempts', '[]'::jsonb) || jsonb_build_array(p_attempt);
  if jsonb_array_length(v_attempts) > 50 then
    select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb)
      into v_attempts
    from jsonb_array_elements(v_attempts) with ordinality
    where ordinality > jsonb_array_length(v_attempts) - 50;
  end if;

  v_queue := coalesce(v_meta->'webhookRetryQueue', '{}'::jsonb);
  if p_retry_state is null then
    v_queue := v_queue - p_delivery_key;
  else
    v_queue := jsonb_set(v_queue, array[p_delivery_key], p_retry_state, true);
  end if;

  v_deliveries := coalesce(v_meta->'webhookDeliveries', '{}'::jsonb);
  if p_delivered_at is not null then
    v_deliveries := jsonb_set(v_deliveries, array[p_delivery_key], to_jsonb(p_delivered_at::text), true);
  end if;

  select min(nullif(value->>'nextRetryAt', '')::timestamptz)
    into v_next_retry_at
  from jsonb_each(v_queue);

  v_meta := v_meta || jsonb_build_object(
    'webhookAttempts', v_attempts,
    'webhookRetryQueue', v_queue,
    'webhookDeliveries', v_deliveries,
    'nextWebhookRetryAt', case when v_next_retry_at is null then 'null'::jsonb else to_jsonb(v_next_retry_at::text) end,
    'lastWebhookDispatchedAt', to_jsonb(now()::text)
  );
  if p_progress is not null then
    v_meta := v_meta || jsonb_build_object(
      'lastWebhookProgress', p_progress,
      'lastWebhookProgressAt', to_jsonb(now()::text)
    );
  end if;

  update public.gateway_async_operations
  set meta = v_meta, updated_at = now()
  where workspace_id = p_workspace_id and kind = p_kind and internal_id = p_internal_id;

  update public.gateway_async_webhook_deliveries
  set status = case when p_next_retry_at is null then 'delivered' else status end,
      claim_token = case when p_next_retry_at is null then null else claim_token end,
      claimed_at = case when p_next_retry_at is null then null else claimed_at end,
      delivered_at = coalesce(p_delivered_at, delivered_at),
      next_attempt_at = p_next_retry_at,
      last_error = p_attempt->>'error_message',
      updated_at = now()
  where workspace_id = p_workspace_id and kind = p_kind
    and internal_id = p_internal_id and delivery_key = p_delivery_key;
end;
$$;

revoke all on function public.enqueue_gateway_async_webhook_delivery(uuid, text, text, text, text, text, double precision, text, text) from public, anon, authenticated;
revoke all on function public.record_gateway_async_webhook_result(uuid, text, text, text, jsonb, jsonb, timestamptz, timestamptz, double precision) from public, anon, authenticated;
grant execute on function public.enqueue_gateway_async_webhook_delivery(uuid, text, text, text, text, text, double precision, text, text) to service_role;
grant execute on function public.record_gateway_async_webhook_result(uuid, text, text, text, jsonb, jsonb, timestamptz, timestamptz, double precision) to service_role;
