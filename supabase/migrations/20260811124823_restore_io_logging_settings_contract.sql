-- Restore the settings contract read by the active gateway I/O logging path.
-- The retired retention-billing tables and charging RPCs are intentionally not
-- recreated; no workspace currently has extended retention enabled.
alter table public.workspace_settings
  add column if not exists io_logging_billing_status text not null default 'active',
  add column if not exists io_logging_grace_until timestamptz,
  add column if not exists io_logging_last_billed_at timestamptz,
  add column if not exists io_logging_last_billing_warning_at timestamptz,
  add column if not exists io_logging_last_billing_warning_kind text,
  add column if not exists io_logging_price_per_million_units_nanos bigint not null default 0;

alter table public.workspace_settings
  drop constraint if exists workspace_settings_io_logging_billing_status_check;
alter table public.workspace_settings
  add constraint workspace_settings_io_logging_billing_status_check
  check (io_logging_billing_status in ('active', 'grace', 'suspended'));

alter table public.workspace_settings
  drop constraint if exists workspace_settings_io_logging_price_per_million_units_check;
alter table public.workspace_settings
  add constraint workspace_settings_io_logging_price_per_million_units_check
  check (io_logging_price_per_million_units_nanos >= 0);

comment on column public.workspace_settings.io_logging_billing_status is
  'Extended-retention state consumed by the gateway I/O logging path.';

comment on column public.workspace_settings.io_logging_price_per_million_units_nanos is
  'Reserved extended-retention price override; zero uses the default.';
