create table if not exists public.checkout_rate_limits (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_start timestamptz not null,
  request_count integer not null check (request_count >= 1),
  primary key (workspace_id, user_id, bucket_start)
);

alter table public.checkout_rate_limits enable row level security;
revoke all on table public.checkout_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.checkout_rate_limits to service_role;

create or replace function public.consume_checkout_rate_limit(
  p_workspace_id uuid,
  p_user_id uuid,
  p_limit integer default 10
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted integer;
  bucket timestamptz := date_trunc('minute', now());
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'invalid_checkout_rate_limit';
  end if;
  delete from public.checkout_rate_limits where bucket_start < now() - interval '1 day';
  insert into public.checkout_rate_limits (workspace_id, user_id, bucket_start, request_count)
  values (p_workspace_id, p_user_id, bucket, 1)
  on conflict (workspace_id, user_id, bucket_start) do update
    set request_count = public.checkout_rate_limits.request_count + 1
    where public.checkout_rate_limits.request_count < p_limit
  returning request_count into accepted;
  return accepted is not null;
end;
$$;

revoke all on function public.consume_checkout_rate_limit(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_checkout_rate_limit(uuid, uuid, integer) to service_role;
