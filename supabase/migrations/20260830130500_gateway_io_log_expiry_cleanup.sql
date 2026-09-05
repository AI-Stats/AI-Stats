-- Support the service-only Worker job that removes expired private I/O log
-- objects and their compact Postgres index rows.
create index if not exists gateway_io_logs_expiry_idx
  on public.gateway_io_logs (io_log_retention_until)
  where io_log_status = 'stored'
    and io_log_object_key is not null
    and io_log_retention_until is not null;

grant delete on table public.gateway_io_logs to service_role;
