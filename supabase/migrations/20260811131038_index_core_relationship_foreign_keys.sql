-- Active operational and account relationships where parent deletion/update
-- should not scan the full child table. Nullable keys use partial indexes.
create index if not exists gateway_async_operations_app_id_idx
  on public.gateway_async_operations (app_id)
  where app_id is not null;

create index if not exists keys_workspace_id_idx
  on public.keys (workspace_id)
  where workspace_id is not null;

create index if not exists keys_created_by_idx
  on public.keys (created_by)
  where created_by is not null;

create index if not exists workspaces_owner_user_id_idx
  on public.workspaces (owner_user_id)
  where owner_user_id is not null;

create index if not exists credit_ledger_workspace_id_idx
  on public.credit_ledger (workspace_id)
  where workspace_id is not null;

create index if not exists users_default_workspace_id_idx
  on public.users (default_workspace_id)
  where default_workspace_id is not null;

create index if not exists oauth_refresh_tokens_rotated_from_idx
  on public.oauth_refresh_tokens (rotated_from)
  where rotated_from is not null;
