create table if not exists billing.gateway_io_retention_billing_runs (
	id uuid primary key default gen_random_uuid() not null,
	workspace_id uuid not null,
	billing_date date not null,
	created_at timestamp with time zone default now() not null,
	processed_at timestamp with time zone,
	status text default 'pending' not null,
	event_units bigint default 0 not null,
	billable_bytes bigint default 0 not null,
	object_count bigint default 0 not null,
	amount_nanos bigint default 0 not null,
	before_balance_nanos bigint,
	after_balance_nanos bigint,
	grace_until timestamp with time zone,
	error text,
	constraint gateway_io_retention_billing_runs_workspace_date_key unique (workspace_id, billing_date),
	constraint gateway_io_retention_billing_runs_status_check check (status in ('pending','charged','already_charged','grace','suspended','skipped','error'))
);
--> statement-breakpoint
create index if not exists gateway_io_retention_billing_runs_workspace_created_idx
	on billing.gateway_io_retention_billing_runs using btree (workspace_id, created_at);
