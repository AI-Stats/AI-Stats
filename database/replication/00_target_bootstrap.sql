-- Run on an empty PlanetScale target before restoring the application schema.
-- Application foreign keys retain the source user UUIDs during migration,
-- while runtime authentication is provided by Better Auth. This table is an
-- identity-copy staging anchor only; no Supabase request-context functions are
-- installed on the target.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key
);
