-- Remove duplicate indexes while preserving the canonical constraints and
-- the canonical partitioned request index.

-- This partitioned index has a duplicate sibling with the same definition;
-- dropping the parent removes its redundant child indexes as well.
drop index if exists public.gateway_requests_workspace_request_id_created_idx;

-- Unconstrained duplicate indexes.
drop index if exists public.api_apps_workspace_id_app_key_key;
drop index if exists public.credit_ledger_ref_unique;

-- Duplicate unique constraints. The retained constraints are
-- api_apps_workspace_appkey_unique and wallets_pkey.
alter table public.api_apps
  drop constraint if exists uniq_workspace_appkey;

alter table public.wallets
  drop constraint if exists wallets_workspace_id_key;

do $assert$
begin
  if to_regclass('public.gateway_requests_workspace_request_id_created_idx') is not null
     or to_regclass('public.api_apps_workspace_id_app_key_key') is not null
     or to_regclass('public.credit_ledger_ref_unique') is not null then
    raise exception 'A duplicate index still exists after cleanup';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname in ('uniq_workspace_appkey', 'wallets_workspace_id_key')
  ) then
    raise exception 'A duplicate unique constraint still exists after cleanup';
  end if;
end
$assert$;
