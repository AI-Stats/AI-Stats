create table if not exists public.gateway_io_retention_billing_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  billing_date date not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'charged', 'already_charged', 'grace', 'suspended', 'skipped', 'error')),
  event_units bigint not null default 0,
  billable_bytes bigint not null default 0,
  object_count bigint not null default 0,
  amount_nanos bigint not null default 0,
  before_balance_nanos bigint,
  after_balance_nanos bigint,
  grace_until timestamptz,
  error text,
  unique (workspace_id, billing_date)
);

create index if not exists gateway_io_retention_billing_runs_workspace_created_idx
  on public.gateway_io_retention_billing_runs (workspace_id, created_at desc);
