create table if not exists public.resend_contact_identities (
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, email),
  check (email = lower(btrim(email)) and position('@' in email) > 1)
);
alter table public.resend_contact_identities enable row level security;
revoke all on table public.resend_contact_identities from anon, authenticated;
grant select, insert, update, delete on table public.resend_contact_identities to service_role;
comment on table public.resend_contact_identities is
  'Prior verified sign-in addresses retained only so account deletion can remove every corresponding Resend contact.';;


-- phaseo:allow-production-history-backfill reason: Restore the exact migration version already recorded in the production ledger.

