-- Atomically merge async-operation metadata and enforce monotonic lifecycle status.
create or replace function public.gateway_set_async_operation_status(
  p_workspace_id uuid,
  p_kind text,
  p_internal_id text,
  p_status text default null,
  p_meta_patch jsonb default '{}'::jsonb,
  p_update_next_reconcile boolean default false,
  p_next_reconcile_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind not in ('video', 'batch') then
    raise exception 'invalid async operation kind';
  end if;

  update public.gateway_async_operations
  set
    status = case
      when p_status is null then status
      when lower(coalesce(status, '')) in ('completed', 'failed', 'cancelled', 'canceled', 'expired') then status
      when (
        case lower(p_status)
          when 'queued' then 1 when 'pending' then 1
          when 'in_progress' then 2 when 'processing' then 2 when 'running' then 2
          when 'completed' then 3 when 'failed' then 3 when 'cancelled' then 3 when 'canceled' then 3 when 'expired' then 3
          else 0
        end
      ) < (
        case lower(coalesce(status, ''))
          when 'queued' then 1 when 'pending' then 1
          when 'in_progress' then 2 when 'processing' then 2 when 'running' then 2
          when 'completed' then 3 when 'failed' then 3 when 'cancelled' then 3 when 'canceled' then 3 when 'expired' then 3
          else 0
        end
      ) then status
      else p_status
    end,
    meta = coalesce(meta, '{}'::jsonb) || coalesce(p_meta_patch, '{}'::jsonb),
    next_reconcile_at = case
      when p_update_next_reconcile then p_next_reconcile_at
      else next_reconcile_at
    end,
    updated_at = now()
  where workspace_id = p_workspace_id
    and kind = p_kind
    and internal_id = p_internal_id;
end;
$$;

revoke all on function public.gateway_set_async_operation_status(uuid, text, text, text, jsonb, boolean, timestamptz) from public;
revoke all on function public.gateway_set_async_operation_status(uuid, text, text, text, jsonb, boolean, timestamptz) from anon;
revoke all on function public.gateway_set_async_operation_status(uuid, text, text, text, jsonb, boolean, timestamptz) from authenticated;
grant execute on function public.gateway_set_async_operation_status(uuid, text, text, text, jsonb, boolean, timestamptz) to service_role;

comment on function public.gateway_set_async_operation_status(uuid, text, text, text, jsonb, boolean, timestamptz) is
  'Service-role-only atomic metadata merge with monotonic async lifecycle transitions.';

-- Remove legacy inline signing secrets. New Video and Batch requests accept only
-- managed endpoint IDs, whose encrypted secret material lives in the dedicated
-- webhook endpoint table.
update public.gateway_async_operations
set meta = jsonb_set(meta, '{webhook}', coalesce(meta->'webhook', '{}'::jsonb) - 'secret', true)
where meta->'webhook' ? 'secret';
