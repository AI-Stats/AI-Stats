create table if not exists public.resend_webhook_events (
  id text primary key,
  event_type text not null,
  email_id text,
  recipient_email_hash text,
  event_created_at timestamptz,
  received_at timestamptz not null default now()
);

create index if not exists resend_webhook_events_email_idx
  on public.resend_webhook_events (email_id, received_at desc);

alter table public.resend_webhook_events enable row level security;
revoke all on table public.resend_webhook_events from anon, authenticated;
grant select, insert, update, delete on table public.resend_webhook_events to service_role;

create table if not exists public.email_delivery_suppressions (
  recipient_email_hash text primary key,
  reason text not null check (reason in ('bounced', 'complained', 'suppressed')),
  source_event_id text references public.resend_webhook_events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_delivery_suppressions enable row level security;
revoke all on table public.email_delivery_suppressions from anon, authenticated;
grant select, insert, update, delete on table public.email_delivery_suppressions to service_role;

comment on table public.resend_webhook_events is
  'Idempotency and operational metadata for verified Resend delivery webhooks. Recipient addresses are stored only as SHA-256 hashes.';
comment on table public.email_delivery_suppressions is
  'Recipients that must not be retried after a Resend bounce, complaint, or suppression event.';
