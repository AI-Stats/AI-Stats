-- Database-authored catalogue pricing.
-- phaseo:allow-destructive-migration reason: Admin-authorized SKU deletion and atomic meter replacement require deleting only the selected V2 pricing records before audited writes.
--
-- The public catalogue remains readable through the existing RLS policies, but
-- mutations are performed only by the backend service role after the web API
-- has verified the signed-in user's public.users.role is exactly "admin".

create table if not exists public.v2_catalogue_admin_changes (
  change_id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  resource_type text not null,
  resource_id text not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now(),
  constraint v2_catalogue_admin_changes_resource_type_check
    check (resource_type in ('pricing_sku')),
  constraint v2_catalogue_admin_changes_action_check
    check (action in ('create', 'update', 'delete'))
);

create index if not exists v2_catalogue_admin_changes_resource_idx
  on public.v2_catalogue_admin_changes (resource_type, resource_id, created_at desc);
create index if not exists v2_catalogue_admin_changes_actor_idx
  on public.v2_catalogue_admin_changes (actor_user_id, created_at desc);

alter table public.v2_catalogue_admin_changes enable row level security;
revoke all on public.v2_catalogue_admin_changes from public, anon, authenticated;
grant select, insert on public.v2_catalogue_admin_changes to service_role;

create table if not exists public.v2_catalogue_source_overrides (
  source_type text not null,
  source_key text not null,
  disposition text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  resource_id text,
  updated_at timestamptz not null default now(),
  primary key (source_type, source_key),
  constraint v2_catalogue_source_overrides_type_check
    check (source_type in ('pricing_rule')),
  constraint v2_catalogue_source_overrides_disposition_check
    check (disposition in ('database_managed', 'suppressed'))
);

alter table public.v2_catalogue_source_overrides enable row level security;
revoke all on public.v2_catalogue_source_overrides from public, anon, authenticated;
grant select, insert, update on public.v2_catalogue_source_overrides to service_role;

create or replace function public.mutate_v2_admin_pricing_sku(
  p_actor_user_id uuid,
  p_model_slug text,
  p_action text,
  p_sku jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sku_id uuid;
  v_provider_model_id text;
  v_existing public.v2_pricing_skus%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_meter jsonb;
  v_resource_id text;
begin
  if p_actor_user_id is null then
    raise exception 'actor_user_id is required';
  end if;
  if coalesce(trim(p_model_slug), '') = '' then
    raise exception 'model_slug is required';
  end if;
  if p_action not in ('save', 'delete') then
    raise exception 'unsupported pricing mutation action';
  end if;
  if not exists (
    select 1 from public.users
    where user_id = p_actor_user_id
      and lower(coalesce(role::text, '')) = 'admin'
  ) then
    raise exception 'actor must have the admin role';
  end if;

  if nullif(p_sku->>'sku_id', '') is not null then
    begin
      v_sku_id := (p_sku->>'sku_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'sku_id must be a UUID';
    end;
  end if;

  if v_sku_id is not null then
    select * into v_existing
    from public.v2_pricing_skus
    where sku_id = v_sku_id;

    if found then
      select jsonb_build_object(
        'sku', to_jsonb(v_existing),
        'meters', coalesce((
          select jsonb_agg(to_jsonb(meter) order by meter.meter_order, meter.meter_key)
          from public.v2_pricing_sku_meters meter
          where meter.sku_id = v_sku_id
        ), '[]'::jsonb)
      ) into v_before;

      if not exists (
        select 1
        from public.v2_model_provider_routes route
        where route.provider_model_id = v_existing.provider_model_id
          and route.model_slug = p_model_slug
      ) then
        raise exception 'pricing SKU does not belong to the requested model';
      end if;
    end if;
  end if;

  if p_action = 'delete' then
    if v_sku_id is null or v_before is null then
      raise exception 'pricing SKU not found';
    end if;
    delete from public.v2_pricing_skus where sku_id = v_sku_id;
    v_resource_id := v_sku_id::text;
    insert into public.v2_catalogue_admin_changes (
      actor_user_id, resource_type, resource_id, action, before_state, after_state
    ) values (
      p_actor_user_id, 'pricing_sku', v_resource_id, 'delete', v_before, null
    );
    if nullif(v_existing.metadata->>'source_key', '') is not null then
      insert into public.v2_catalogue_source_overrides (
        source_type, source_key, disposition, actor_user_id, resource_id, updated_at
      ) values (
        'pricing_rule', v_existing.metadata->>'source_key', 'suppressed', p_actor_user_id, v_resource_id, now()
      )
      on conflict (source_type, source_key) do update set
        disposition = excluded.disposition,
        actor_user_id = excluded.actor_user_id,
        resource_id = excluded.resource_id,
        updated_at = now();
    end if;
    return jsonb_build_object('deleted', true, 'sku_id', v_resource_id);
  end if;

  v_provider_model_id := nullif(trim(p_sku->>'provider_model_id'), '');
  if v_provider_model_id is null then
    raise exception 'provider_model_id is required';
  end if;
  if not exists (
    select 1
    from public.v2_model_provider_routes route
    where route.provider_model_id = v_provider_model_id
      and route.model_slug = p_model_slug
  ) then
    raise exception 'provider route does not belong to the requested model';
  end if;
  if jsonb_typeof(coalesce(p_sku->'meters', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_sku->'meters', '[]'::jsonb)) = 0 then
    raise exception 'at least one pricing meter is required';
  end if;

  if v_sku_id is null then
    select sku_id into v_sku_id
    from public.v2_pricing_skus
    where provider_model_id = v_provider_model_id
      and sku_code = lower(trim(p_sku->>'sku_code'))
      and version = coalesce(nullif(trim(p_sku->>'version'), '')::integer, 1);
    if found then
      select * into v_existing from public.v2_pricing_skus where sku_id = v_sku_id;
      select jsonb_build_object(
        'sku', to_jsonb(v_existing),
        'meters', coalesce((select jsonb_agg(to_jsonb(meter) order by meter.meter_order, meter.meter_key) from public.v2_pricing_sku_meters meter where meter.sku_id = v_sku_id), '[]'::jsonb)
      ) into v_before;
    end if;
  end if;

  v_sku_id := coalesce(v_sku_id, gen_random_uuid());
  insert into public.v2_pricing_skus (
    sku_id,
    provider_model_id,
    sku_code,
    version,
    operation,
    status,
    region,
    service_tier_slug,
    display_name,
    description,
    currency,
    effective_from,
    effective_to,
    metadata,
    updated_at
  ) values (
    v_sku_id,
    v_provider_model_id,
    lower(trim(p_sku->>'sku_code')),
    coalesce(nullif(trim(p_sku->>'version'), '')::integer, 1),
    coalesce(nullif(trim(p_sku->>'operation'), ''), 'inference'),
    coalesce(nullif(trim(p_sku->>'status'), ''), 'active'),
    nullif(trim(p_sku->>'region'), ''),
    coalesce(nullif(trim(p_sku->>'service_tier_slug'), ''), 'standard'),
    trim(p_sku->>'display_name'),
    nullif(trim(p_sku->>'description'), ''),
    upper(coalesce(nullif(trim(p_sku->>'currency'), ''), 'USD')),
    coalesce(nullif(trim(p_sku->>'effective_from'), '')::timestamptz, now()),
    nullif(p_sku->>'effective_to', '')::timestamptz,
    coalesce(p_sku->'metadata', '{}'::jsonb) || jsonb_build_object(
      'source', 'admin',
      'authored_by', p_actor_user_id,
      'authored_at', now()
    ),
    now()
  )
  on conflict (sku_id) do update set
    provider_model_id = excluded.provider_model_id,
    sku_code = excluded.sku_code,
    version = excluded.version,
    operation = excluded.operation,
    status = excluded.status,
    region = excluded.region,
    service_tier_slug = excluded.service_tier_slug,
    display_name = excluded.display_name,
    description = excluded.description,
    currency = excluded.currency,
    effective_from = excluded.effective_from,
    effective_to = excluded.effective_to,
    metadata = excluded.metadata,
    updated_at = now();

  delete from public.v2_pricing_sku_meters where sku_id = v_sku_id;

  for v_meter in select value from jsonb_array_elements(p_sku->'meters')
  loop
    insert into public.v2_pricing_sku_meters (
      sku_id,
      meter_key,
      modality,
      direction,
      unit,
      unit_quantity,
      price_nanos,
      display_label,
      display_unit,
      billable,
      meter_order,
      metadata
    ) values (
      v_sku_id,
      lower(trim(v_meter->>'meter_key')),
      lower(trim(v_meter->>'modality')),
      nullif(lower(trim(v_meter->>'direction')), ''),
      lower(trim(v_meter->>'unit')),
      (v_meter->>'unit_quantity')::numeric,
      (v_meter->>'price_nanos')::numeric,
      trim(v_meter->>'display_label'),
      trim(v_meter->>'display_unit'),
      coalesce((v_meter->>'billable')::boolean, true),
      coalesce((v_meter->>'meter_order')::integer, 100),
      coalesce(v_meter->'metadata', '{}'::jsonb) || jsonb_build_object('source', 'admin')
    );
  end loop;

  select jsonb_build_object(
    'sku', to_jsonb(sku),
    'meters', coalesce((
      select jsonb_agg(to_jsonb(meter) order by meter.meter_order, meter.meter_key)
      from public.v2_pricing_sku_meters meter
      where meter.sku_id = v_sku_id
    ), '[]'::jsonb)
  ) into v_after
  from public.v2_pricing_skus sku
  where sku.sku_id = v_sku_id;

  v_resource_id := v_sku_id::text;
  insert into public.v2_catalogue_admin_changes (
    actor_user_id, resource_type, resource_id, action, before_state, after_state
  ) values (
    p_actor_user_id,
    'pricing_sku',
    v_resource_id,
    case when v_before is null then 'create' else 'update' end,
    v_before,
    v_after
  );

  if nullif(p_sku->'metadata'->>'source_key', '') is not null then
    insert into public.v2_catalogue_source_overrides (
      source_type, source_key, disposition, actor_user_id, resource_id, updated_at
    ) values (
      'pricing_rule', p_sku->'metadata'->>'source_key', 'database_managed', p_actor_user_id, v_resource_id, now()
    )
    on conflict (source_type, source_key) do update set
      disposition = excluded.disposition,
      actor_user_id = excluded.actor_user_id,
      resource_id = excluded.resource_id,
      updated_at = now();
  end if;

  return v_after;
end;
$$;

revoke all on function public.mutate_v2_admin_pricing_sku(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.mutate_v2_admin_pricing_sku(uuid, text, text, jsonb)
  to service_role;

comment on table public.v2_catalogue_admin_changes is
  'Immutable audit trail for database-authored catalogue mutations made by internal admins.';
comment on function public.mutate_v2_admin_pricing_sku(uuid, text, text, jsonb) is
  'Atomically creates, updates, or deletes one pricing SKU and its meters. Service role only, with a database-backed admin actor check.';
comment on table public.v2_catalogue_source_overrides is
  'Prevents repository imports from recreating or overwriting catalogue records that an admin moved under database ownership.';
