create table if not exists public.payment_method_mutation_leases (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  claim_token uuid not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.payment_method_mutation_leases enable row level security;
revoke all on table public.payment_method_mutation_leases from public, anon, authenticated;
grant select, insert, update, delete on public.payment_method_mutation_leases to service_role;

create or replace function public.claim_payment_method_mutation(
  p_workspace_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed uuid;
begin
  insert into public.payment_method_mutation_leases (workspace_id, claim_token, expires_at, updated_at)
  values (p_workspace_id, p_claim_token, now() + interval '10 minutes', now())
  on conflict (workspace_id) do update
    set claim_token = excluded.claim_token,
        expires_at = excluded.expires_at,
        updated_at = now()
    where public.payment_method_mutation_leases.expires_at <= now()
  returning claim_token into claimed;
  return claimed = p_claim_token;
end;
$$;

create or replace function public.renew_payment_method_mutation(
  p_workspace_id uuid,
  p_claim_token uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  with renewed as (
    update public.payment_method_mutation_leases
    set expires_at = now() + interval '10 minutes', updated_at = now()
    where workspace_id = p_workspace_id
      and claim_token = p_claim_token
      and expires_at > now()
    returning workspace_id
  )
  select exists(select 1 from renewed);
$$;

create or replace function public.release_payment_method_mutation(
  p_workspace_id uuid,
  p_claim_token uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.payment_method_mutation_leases
    where workspace_id = p_workspace_id and claim_token = p_claim_token
    returning workspace_id
  )
  select exists(select 1 from deleted);
$$;

revoke all on function public.claim_payment_method_mutation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.renew_payment_method_mutation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_payment_method_mutation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_payment_method_mutation(uuid, uuid) to service_role;
grant execute on function public.renew_payment_method_mutation(uuid, uuid) to service_role;
grant execute on function public.release_payment_method_mutation(uuid, uuid) to service_role;
