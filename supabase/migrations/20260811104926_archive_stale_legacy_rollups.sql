-- The old rollup rows stop on 2026-07-26 and do not exactly match the V2
-- projections. Preserve them privately while removing the old public tables.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to service_role;

alter table if exists public.gateway_model_usage_daily set schema private;
alter table if exists public.public_app_model_usage_daily set schema private;

revoke all on table private.gateway_model_usage_daily, private.public_app_model_usage_daily from public, anon, authenticated;
grant all on table private.gateway_model_usage_daily, private.public_app_model_usage_daily to service_role;

comment on table private.gateway_model_usage_daily is
  'Archived pre-V2 daily gateway usage rollup. Retained for historical comparison after the V2 analytics cutover.';
comment on table private.public_app_model_usage_daily is
  'Archived pre-V2 public app/model daily rollup. Retained for historical comparison after the V2 analytics cutover.';

do $assert$
begin
  if to_regclass('public.gateway_model_usage_daily') is not null
     or to_regclass('public.public_app_model_usage_daily') is not null then
    raise exception 'Legacy rollup tables remain in public schema';
  end if;
  if to_regclass('private.gateway_model_usage_daily') is null
     or to_regclass('private.public_app_model_usage_daily') is null then
    raise exception 'Legacy rollup tables were not preserved in private schema';
  end if;
end
$assert$;
