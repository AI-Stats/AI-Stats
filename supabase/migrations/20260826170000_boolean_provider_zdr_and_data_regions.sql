-- Make the public privacy model route-specific and boolean:
--   true  = this exact offer guarantees zero request-content retention by default
--   false = ZDR is not guaranteed for this offer
-- Optional/provider-level capabilities are intentionally not represented here.

alter table if exists public.data_api_providers
  drop constraint if exists data_api_providers_zero_data_retention_check;
alter table if exists public.data_api_providers
  alter column zero_data_retention drop default;
alter table if exists public.data_api_providers
  alter column zero_data_retention type boolean
  using (lower(trim(zero_data_retention)) = 'default');
alter table if exists public.data_api_providers
  alter column zero_data_retention set default false,
  alter column zero_data_retention set not null;
alter table if exists public.data_api_providers
  add constraint data_api_providers_zero_data_retention_check
  check (zero_data_retention in (true, false));

create temporary table _v2_rpc_providers_compat_view_definition (
  definition text
) on commit drop;

do $$
begin
  if to_regclass('private.v2_rpc_providers_compat') is not null then
    insert into _v2_rpc_providers_compat_view_definition (definition)
    values (pg_get_viewdef('private.v2_rpc_providers_compat'::regclass, true));
    execute 'drop view private.v2_rpc_providers_compat';
  end if;
end;
$$;

alter table if exists public.v2_providers
  drop constraint if exists v2_providers_zero_data_retention_check,
  drop constraint if exists v2_providers_zdr_variant_integrity_check;
alter table if exists public.v2_providers
  alter column zero_data_retention drop default;
alter table if exists public.v2_providers
  alter column zero_data_retention type boolean
  using (lower(trim(zero_data_retention)) = 'default');
alter table if exists public.v2_providers
  alter column zero_data_retention set default false,
  alter column zero_data_retention set not null;

do $$
declare
  definition text;
begin
  select stored.definition
  into definition
  from _v2_rpc_providers_compat_view_definition stored
  limit 1;
  if definition is not null then
    execute 'create view private.v2_rpc_providers_compat as ' || definition;
  end if;
end;
$$;

alter table if exists public.v2_providers
  add constraint v2_providers_zero_data_retention_check
  check (zero_data_retention in (true, false));
alter table if exists public.v2_providers
  add constraint v2_providers_zdr_variant_integrity_check
  check (
    data_policy_variant <> 'zdr'
    or (
      offer_scope = 'specialized'
      and zero_data_retention is true
      and data_policy_tier = 'private'
      and data_policy_confidence = 'confirmed'
    )
  );

comment on column public.v2_providers.zero_data_retention is
  'Whether this exact provider offer guarantees zero request-content retention by default. False means ZDR is not guaranteed; it does not mean another offer cannot provide ZDR.';
