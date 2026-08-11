-- The Data API hardening migration removed client CRUD/EXECUTE defaults.
-- Revoke PostgreSQL-only privileges as well so future objects are fully opt-in.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on functions from public, anon, authenticated, service_role;
