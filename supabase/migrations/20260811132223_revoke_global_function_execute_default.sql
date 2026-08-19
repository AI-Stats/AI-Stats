-- PostgreSQL grants function execution to PUBLIC globally by default.
-- A schema-scoped revoke cannot override that built-in global default.
alter default privileges for role postgres
  revoke execute on functions from public;
