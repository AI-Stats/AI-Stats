-- The pre-V2 usage rollups were archived in private during the V2 cutover.
-- Their public replacements are backed by v2_public_usage_daily and its views.
-- Drop without CASCADE so any unexpected dependency aborts this migration.

drop table if exists private.gateway_model_usage_daily;
drop table if exists private.public_app_model_usage_daily;

do $assert$
begin
  if to_regclass('private.gateway_model_usage_daily') is not null
     or to_regclass('private.public_app_model_usage_daily') is not null then
    raise exception 'Archived V1 usage rollup tables still exist after cleanup';
  end if;
end
$assert$;
