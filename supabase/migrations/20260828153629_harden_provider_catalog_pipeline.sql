-- Serialize provider catalog publication and stage immutable route candidates.

alter table public.provider_catalog_sources
  add column if not exists sync_lease_token uuid,
  add column if not exists sync_lease_expires_at timestamptz,
  add column if not exists refresh_requested boolean not null default false;

create table if not exists public.provider_catalog_route_candidates (
  run_id uuid not null references public.provider_catalog_sync_runs(id) on delete cascade,
  provider_slug text not null references public.v2_providers(provider_slug) on delete cascade,
  submitted_model_slug text not null,
  canonical_model_slug text not null references public.v2_models(model_slug) on delete cascade,
  provider_model_slug text not null,
  availability text not null,
  input_modalities text[] not null default '{}'::text[],
  output_modalities text[] not null default '{}'::text[],
  context_length integer,
  max_output_tokens integer,
  available_from timestamptz,
  deprecated_at timestamptz,
  shutdown_at timestamptz,
  capabilities jsonb not null default '[]'::jsonb,
  pricing jsonb not null default '[]'::jsonb,
  status text not null default 'pending_probe',
  probe_summary jsonb not null default '{}'::jsonb,
  probed_by uuid references auth.users(id) on delete set null,
  probed_at timestamptz,
  promoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (run_id, submitted_model_slug),
  constraint provider_catalog_route_candidates_status_check
    check (status in ('pending_probe', 'probe_failed', 'probe_passed', 'promoted', 'rejected')),
  constraint provider_catalog_route_candidates_availability_check
    check (availability in ('ready', 'not_ready', 'degraded', 'deprecated', 'retired'))
);

create index if not exists provider_catalog_route_candidates_queue_idx
  on public.provider_catalog_route_candidates (status, created_at desc);
alter table public.provider_catalog_route_candidates enable row level security;
revoke all on public.provider_catalog_route_candidates from anon, authenticated;
grant select, insert, update on public.provider_catalog_route_candidates to service_role;

create or replace function public.claim_provider_catalog_sync(
  p_provider_slug text,
  p_lease_token uuid,
  p_lease_seconds integer default 120
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected integer;
begin
  update public.provider_catalog_sources
  set sync_lease_token = p_lease_token,
      sync_lease_expires_at = now() + make_interval(secs => greatest(30, least(p_lease_seconds, 300))),
      updated_at = now()
  where provider_slug = p_provider_slug
    and status = 'active'
    and (sync_lease_expires_at is null or sync_lease_expires_at <= now());
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

create or replace function public.release_provider_catalog_sync(
  p_provider_slug text,
  p_lease_token uuid
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.provider_catalog_sources
  set sync_lease_token = null, sync_lease_expires_at = null, updated_at = now()
  where provider_slug = p_provider_slug and sync_lease_token = p_lease_token;
$$;

revoke all on function public.claim_provider_catalog_sync(text, uuid, integer) from public;
revoke all on function public.release_provider_catalog_sync(text, uuid) from public;
grant execute on function public.claim_provider_catalog_sync(text, uuid, integer) to service_role;
grant execute on function public.release_provider_catalog_sync(text, uuid) to service_role;


create or replace function public.consume_provider_catalog_refresh(p_provider_slug text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected integer;
begin
  update public.provider_catalog_sources
  set refresh_requested = false, updated_at = now()
  where provider_slug = p_provider_slug and refresh_requested = true;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;
revoke all on function public.consume_provider_catalog_refresh(text) from public;
grant execute on function public.consume_provider_catalog_refresh(text) to service_role;


create or replace function public.set_workspace_kind()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.workspace_kind = 'provider' then return new; end if;
  if lower(coalesce(new.tier, '')) = 'enterprise' then
    new.workspace_kind := 'enterprise';
  elsif lower(coalesce(new.name, '')) = 'personal' then
    new.workspace_kind := 'personal';
  elsif tg_op = 'INSERT' or new.workspace_kind in ('personal', 'enterprise') then
    new.workspace_kind := 'organization';
  end if;
  return new;
end;
$$;

drop trigger if exists set_workspace_kind_trigger on public.workspaces;
create trigger set_workspace_kind_trigger
before insert or update of name, tier, workspace_kind on public.workspaces
for each row execute function public.set_workspace_kind();

revoke all on function public.set_workspace_kind() from public;
grant execute on function public.set_workspace_kind() to service_role;


create or replace function public.promote_provider_catalog_candidate(
  p_run_id uuid,
  p_submitted_model_slug text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  candidate public.provider_catalog_route_candidates%rowtype;
  provider_model_id_value text;
  capability jsonb;
  price jsonb;
  sku_id_value uuid;
  sku_version_value integer;
  route_status text;
begin
  select * into candidate from public.provider_catalog_route_candidates
  where run_id = p_run_id and submitted_model_slug = p_submitted_model_slug for update;
  if not found then raise exception 'provider_catalog_candidate_not_found'; end if;
  if candidate.status <> 'probe_passed' then raise exception 'provider_catalog_probe_required'; end if;
  if exists (
    select 1 from public.provider_catalog_sync_runs newer
    join public.provider_catalog_sync_runs current_run on current_run.id = candidate.run_id
    where newer.provider_slug = candidate.provider_slug and newer.status = 'applied'
      and newer.created_at > current_run.created_at
  ) then raise exception 'provider_catalog_candidate_superseded'; end if;
  if jsonb_array_length(candidate.pricing) = 0 then raise exception 'provider_catalog_pricing_required'; end if;
  if not coalesce((select (metadata ->> 'adapter_ready')::boolean from public.v2_providers where provider_slug = candidate.provider_slug), false) then raise exception 'provider_catalog_adapter_required'; end if;
  if not coalesce((select (metadata ->> 'credentials_ready')::boolean from public.v2_providers where provider_slug = candidate.provider_slug), false) then raise exception 'provider_catalog_credentials_required'; end if;
  if not exists (select 1 from public.v2_providers where provider_slug = candidate.provider_slug and nullif(trim(base_url), '') is not null) then raise exception 'provider_catalog_endpoint_required'; end if;

  select provider_model_id into provider_model_id_value
  from public.v2_model_provider_routes
  where provider_slug = candidate.provider_slug
    and model_slug = candidate.canonical_model_slug
    and provider_model_slug = candidate.provider_model_slug
  order by created_at limit 1;
  if provider_model_id_value is null then
    provider_model_id_value := candidate.provider_slug || ':' || candidate.canonical_model_slug || ':' || candidate.provider_model_slug;
  end if;

  route_status := case candidate.availability when 'ready' then 'active' when 'degraded' then 'degraded' when 'retired' then 'retired' else 'disabled' end;

  insert into public.v2_model_provider_routes (
    provider_model_id, model_slug, provider_slug, provider_model_slug, status,
    routing_enabled, input_modalities, output_modalities, context_length,
    max_output_tokens, effective_from, effective_to, metadata, updated_at
  ) values (
    provider_model_id_value, candidate.canonical_model_slug, candidate.provider_slug,
    candidate.provider_model_slug, route_status, candidate.availability in ('ready', 'degraded'),
    candidate.input_modalities, candidate.output_modalities, candidate.context_length,
    candidate.max_output_tokens, candidate.available_from, candidate.shutdown_at,
    jsonb_build_object('managed_by', 'provider_catalog', 'source_run_id', candidate.run_id, 'deprecated_at', candidate.deprecated_at), now()
  )
  on conflict (provider_model_id) do update set
    provider_model_slug = excluded.provider_model_slug, status = excluded.status,
    routing_enabled = excluded.routing_enabled, input_modalities = excluded.input_modalities,
    output_modalities = excluded.output_modalities, context_length = excluded.context_length,
    max_output_tokens = excluded.max_output_tokens, effective_from = excluded.effective_from,
    effective_to = excluded.effective_to,
    metadata = public.v2_model_provider_routes.metadata || excluded.metadata, updated_at = now();

  update public.v2_route_capabilities set status = 'disabled', updated_at = now()
  where provider_model_id = provider_model_id_value;

  for capability in select value from jsonb_array_elements(candidate.capabilities)
  loop
    insert into public.v2_route_capabilities (
      provider_model_id, capability_id, status, max_output_tokens, params,
      effective_from, effective_to, metadata, updated_at
    ) values (
      provider_model_id_value, capability ->> 'id',
      case when route_status in ('active', 'degraded') then route_status else 'disabled' end,
      candidate.max_output_tokens,
      coalesce((select jsonb_object_agg(p.value, true) from jsonb_array_elements_text(coalesce(capability -> 'parameters', '[]'::jsonb)) as p(value)), '{}'::jsonb),
      candidate.available_from, candidate.shutdown_at,
      jsonb_build_object('managed_by', 'provider_catalog', 'source_run_id', candidate.run_id), now()
    )
    on conflict (provider_model_id, capability_id) do update set
      status = excluded.status, max_output_tokens = excluded.max_output_tokens,
      params = excluded.params, effective_from = excluded.effective_from,
      effective_to = excluded.effective_to,
      metadata = public.v2_route_capabilities.metadata || excluded.metadata, updated_at = now();
  end loop;

  update public.v2_pricing_skus
  set status = 'deprecated', effective_to = now(), updated_at = now()
  where provider_model_id = provider_model_id_value
    and sku_code = 'provider-catalog-standard' and status = 'active';
  select coalesce(max(version), 0) + 1 into sku_version_value
  from public.v2_pricing_skus
  where provider_model_id = provider_model_id_value and sku_code = 'provider-catalog-standard';
  insert into public.v2_pricing_skus (
    provider_model_id, sku_code, version, operation, status, display_name,
    currency, effective_from, metadata
  ) values (
    provider_model_id_value, 'provider-catalog-standard', sku_version_value,
    'inference', 'active', 'Provider catalog pricing', 'USD', now(),
    jsonb_build_object('managed_by', 'provider_catalog', 'source_run_id', candidate.run_id)
  ) returning sku_id into sku_id_value;
  for price in select value from jsonb_array_elements(candidate.pricing)
  loop
    insert into public.v2_pricing_sku_meters (
      sku_id, meter_key, modality, direction, unit, unit_quantity,
      price_nanos, display_label, display_unit, metadata
    ) values (
      sku_id_value, price ->> 'meterKey', price ->> 'modality', nullif(price ->> 'direction', ''),
      price ->> 'unit', (price ->> 'unitQuantity')::numeric,
      (price ->> 'priceNanos')::numeric, price ->> 'displayLabel', price ->> 'displayUnit',
      jsonb_build_object('managed_by', 'provider_catalog', 'source_run_id', candidate.run_id)
    );
  end loop;

  update public.v2_providers
  set status = case when status = 'not_ready' then 'beta' else status end,
      routable = true, routing_enabled = true, updated_at = now()
  where provider_slug = candidate.provider_slug;

  update public.provider_catalog_route_candidates
  set status = 'promoted', promoted_at = now(), updated_at = now()
  where run_id = p_run_id and submitted_model_slug = p_submitted_model_slug;

  update public.provider_catalog_sync_models
  set route_projection_status = 'enabled', route_projection_error = null
  where run_id = p_run_id and model_slug = p_submitted_model_slug;

  return provider_model_id_value;
end;
$$;

revoke all on function public.promote_provider_catalog_candidate(uuid, text) from public;
grant execute on function public.promote_provider_catalog_candidate(uuid, text) to service_role;


create or replace function public.enqueue_provider_catalog_event_email()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.workspace_id is null then return new; end if;
  insert into public.email_outbox (kind, template, to_email, subject, workspace_id, user_id, payload)
  select
    new.event_type, 'generic', u.email, new.title, new.workspace_id, u.user_id,
    jsonb_build_object('message', new.message, 'provider_slug', new.provider_slug, 'run_id', new.run_id)
  from public.workspace_members wm
  join public.users u on u.user_id = wm.user_id
  where wm.workspace_id = new.workspace_id and nullif(trim(u.email), '') is not null;
  return new;
end;
$$;

drop trigger if exists enqueue_provider_catalog_event_email_trigger on public.provider_catalog_events;
create trigger enqueue_provider_catalog_event_email_trigger
after insert on public.provider_catalog_events
for each row execute function public.enqueue_provider_catalog_event_email();

revoke all on function public.enqueue_provider_catalog_event_email() from public;
grant execute on function public.enqueue_provider_catalog_event_email() to service_role;


create table if not exists public.provider_claim_challenges (
  id uuid primary key default gen_random_uuid(),
  provider_slug text not null references public.v2_providers(provider_slug) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  token_hash text not null,
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '1 hour'),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint provider_claim_challenges_status_check check (status in ('pending', 'verified', 'expired', 'cancelled'))
);
create index if not exists provider_claim_challenges_request_idx
  on public.provider_claim_challenges (requested_by, provider_slug, created_at desc);
alter table public.provider_claim_challenges enable row level security;
revoke all on public.provider_claim_challenges from anon, authenticated;
grant select, insert, update on public.provider_claim_challenges to service_role;
