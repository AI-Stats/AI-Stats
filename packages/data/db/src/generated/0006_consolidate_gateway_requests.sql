begin;

-- The gateway currently contains only thousands of rows. A single table keeps
-- the write and query path simple without requiring ongoing partition jobs.
lock table observability.gateway_upstream_requests in access exclusive mode;
lock table observability.gateway_requests in access exclusive mode;

do $$
begin
  if to_regclass('observability.gateway_requests_partitioned_backup_20260817') is not null
     or to_regclass('observability.gateway_upstream_requests_partitioned_backup_20260817') is not null
     or to_regclass('observability.gateway_requests_unpartitioned') is not null
     or to_regclass('observability.gateway_upstream_requests_unpartitioned') is not null then
    raise exception 'gateway consolidation staging or backup tables already exist';
  end if;
end
$$;

create table observability.gateway_requests_unpartitioned
  (like observability.gateway_requests including all);

create table observability.gateway_upstream_requests_unpartitioned
  (like observability.gateway_upstream_requests including all);

do $$
declare
  column_list text;
begin
  select string_agg(quote_ident(attribute.attname), ', ' order by attribute.attnum)
    into column_list
  from pg_attribute attribute
  where attribute.attrelid = 'observability.gateway_requests'::regclass
    and attribute.attnum > 0
    and not attribute.attisdropped
    and attribute.attgenerated = '';

  execute format(
    'insert into observability.gateway_requests_unpartitioned (%1$s) select %1$s from observability.gateway_requests',
    column_list
  );

  select string_agg(quote_ident(attribute.attname), ', ' order by attribute.attnum)
    into column_list
  from pg_attribute attribute
  where attribute.attrelid = 'observability.gateway_upstream_requests'::regclass
    and attribute.attnum > 0
    and not attribute.attisdropped
    and attribute.attgenerated = '';

  execute format(
    'insert into observability.gateway_upstream_requests_unpartitioned (%1$s) select %1$s from observability.gateway_upstream_requests',
    column_list
  );
end
$$;

do $$
declare
  source_gateway_count bigint;
  target_gateway_count bigint;
  source_upstream_count bigint;
  target_upstream_count bigint;
begin
  select count(*) into source_gateway_count from observability.gateway_requests;
  select count(*) into target_gateway_count from observability.gateway_requests_unpartitioned;
  select count(*) into source_upstream_count from observability.gateway_upstream_requests;
  select count(*) into target_upstream_count from observability.gateway_upstream_requests_unpartitioned;

  if source_gateway_count <> target_gateway_count
     or source_upstream_count <> target_upstream_count then
    raise exception 'gateway consolidation row-count mismatch: requests %/%, upstream %/%',
      source_gateway_count, target_gateway_count,
      source_upstream_count, target_upstream_count;
  end if;
end
$$;

-- This view has an OID dependency on the partitioned parent and is recreated
-- against the replacement table after the atomic name swap.
drop view gateway.oauth_apps_with_stats;

alter table observability.v2_request_facts
  drop constraint v2_request_facts_gateway_request_fkey;

alter table observability.gateway_requests
  rename to gateway_requests_partitioned_backup_20260817;
alter table observability.gateway_upstream_requests
  rename to gateway_upstream_requests_partitioned_backup_20260817;

alter table observability.gateway_requests_unpartitioned
  rename to gateway_requests;
alter table observability.gateway_upstream_requests_unpartitioned
  rename to gateway_upstream_requests;

alter table observability.gateway_requests
  add constraint gateway_requests_workspace_id_fkey
    foreign key (workspace_id) references app.workspaces(id) on delete cascade,
  add constraint gateway_requests_app_id_fkey
    foreign key (app_id) references gateway.api_apps(id) on delete set null,
  add constraint gateway_requests_key_id_fkey
    foreign key (key_id) references gateway.keys(id) on delete set null;

alter table observability.gateway_upstream_requests
  add constraint gateway_upstream_requests_workspace_id_fkey
    foreign key (workspace_id) references app.workspaces(id) on delete cascade,
  add constraint gateway_upstream_requests_app_id_fkey
    foreign key (app_id) references gateway.api_apps(id) on delete set null,
  add constraint gateway_upstream_requests_key_id_fkey
    foreign key (key_id) references gateway.keys(id) on delete set null,
  add constraint gateway_upstream_requests_gateway_request_fkey
    foreign key (gateway_request_id, gateway_request_created_at)
    references observability.gateway_requests(id, created_at) on delete cascade;

alter table observability.v2_request_facts
  add constraint v2_request_facts_gateway_request_fkey
    foreign key (gateway_request_id, gateway_request_created_at)
    references observability.gateway_requests(id, created_at) on delete cascade;

create view gateway.oauth_apps_with_stats
with (security_invoker = true) as
select
  oam.id,
  oam.client_id,
  oam.workspace_id,
  oam.name,
  oam.description,
  oam.homepage_url,
  oam.logo_url,
  oam.privacy_policy_url,
  oam.terms_of_service_url,
  oam.created_by,
  oam.created_at,
  oam.updated_at,
  oam.status,
  oam.redirect_uris,
  count(distinct oa.id) filter (where oa.revoked_at is null) as active_authorizations,
  count(distinct oa.id) as total_authorizations,
  max(oa.last_used_at) as last_used_at,
  count(distinct gr.id) as requests_last_30d
from gateway.oauth_app_metadata oam
left join gateway.oauth_authorizations oa
  on oa.client_id = oam.client_id
left join observability.gateway_requests gr
  on gr.oauth_client_id = oam.client_id
 and gr.created_at > now() - interval '30 days'
where oam.status = 'active'
group by oam.id;

-- These functions formed the old Supabase/PostgREST RPC layer. Runtime code
-- now uses Drizzle repositories. Drop only functions whose definitions still
-- reference the private compatibility views; dependency failures abort the
-- transaction instead of cascading into unrelated objects.
do $$
declare
  function_record record;
begin
  for function_record in
    select namespace.nspname as schema_name,
           procedure.proname as function_name,
           pg_get_function_identity_arguments(procedure.oid) as identity_arguments
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where procedure.prokind in ('f', 'p')
      and pg_get_functiondef(procedure.oid) like '%private.v2_rpc_%_compat%'
  loop
    execute format(
      'drop function %I.%I(%s)',
      function_record.schema_name,
      function_record.function_name,
      function_record.identity_arguments
    );
  end loop;
end
$$;

drop view if exists observability.v2_web_gateway_requests;

drop view private.v2_rpc_benchmark_results_compat;
drop view private.v2_rpc_benchmarks_compat;
drop view private.v2_rpc_capabilities_compat;
drop view private.v2_rpc_gateway_requests_compat;
drop view private.v2_rpc_labs_compat;
drop view private.v2_rpc_models_compat;
drop view private.v2_rpc_pricing_compat;
drop view private.v2_rpc_providers_compat;
drop view private.v2_rpc_routes_compat;
drop view private.v2_rpc_subscription_features_compat;
drop view private.v2_rpc_subscription_models_compat;
drop view private.v2_rpc_subscription_plans_compat;

do $$
begin
  if (select count(*) from observability.gateway_requests)
       <> (select count(*) from observability.gateway_requests_partitioned_backup_20260817)
     or (select count(*) from observability.gateway_upstream_requests)
       <> (select count(*) from observability.gateway_upstream_requests_partitioned_backup_20260817) then
    raise exception 'post-swap gateway row-count mismatch';
  end if;

  if exists (
    select 1
    from observability.gateway_upstream_requests upstream
    left join observability.gateway_requests request
      on request.id = upstream.gateway_request_id
     and request.created_at = upstream.gateway_request_created_at
    where upstream.gateway_request_id is not null
      and request.id is null
  ) then
    raise exception 'post-swap orphan gateway upstream request detected';
  end if;
end
$$;

commit;
