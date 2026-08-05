-- Make free offers first-class V2 model variants.
--
-- Provider JSON remains the authoring source for the offer itself. V2 derives a
-- separate canonical model identity so catalogue, usage, pricing, and
-- performance queries never merge `{model}` and `{model}:free`.

alter table public.v2_models
  add column if not exists variant_kind text not null default 'standard',
  add column if not exists base_model_slug text references public.v2_models(model_slug) on delete restrict;

alter table public.v2_models
  drop constraint if exists v2_models_variant_kind_check,
  add constraint v2_models_variant_kind_check
    check (variant_kind in ('standard', 'free')),
  drop constraint if exists v2_models_variant_identity_check,
  add constraint v2_models_variant_identity_check check (
    (variant_kind = 'standard' and model_slug !~ ':free$' and base_model_slug is null)
    or
    (variant_kind = 'free' and model_slug ~ ':free$' and base_model_slug is not null and base_model_slug <> model_slug)
  );

create unique index if not exists v2_models_one_free_variant_per_base_idx
  on public.v2_models (base_model_slug)
  where variant_kind = 'free';

create index if not exists v2_models_variant_lookup_idx
  on public.v2_models (variant_kind, base_model_slug, model_slug);

with free_bases as (
  select distinct route.model_slug as base_model_slug
  from public.v2_model_provider_routes route
  where lower(route.provider_model_id) like '%:free'
    and lower(route.model_slug) not like '%:free'
)
insert into public.v2_models (
  model_slug,
  lab_slug,
  name,
  description,
  status,
  hidden,
  input_modalities,
  output_modalities,
  family_slug,
  announced_at,
  released_at,
  deprecated_at,
  retired_at,
  metadata,
  previous_model_slug,
  removal_date,
  replacement_model_slug,
  license,
  license_url,
  variant_kind,
  base_model_slug
)
select
  base.model_slug || ':free',
  base.lab_slug,
  case
    when base.name ~* '\(\s*free\s*\)$' then regexp_replace(base.name, '\(\s*free\s*\)$', '(Free)', 'i')
    else base.name || ' (Free)'
  end,
  base.description,
  base.status,
  base.hidden,
  base.input_modalities,
  base.output_modalities,
  base.family_slug,
  base.announced_at,
  base.released_at,
  base.deprecated_at,
  base.retired_at,
  base.metadata || jsonb_build_object(
    'variant_kind', 'free',
    'base_model_slug', base.model_slug,
    'derived_from_provider_json', true
  ),
  base.previous_model_slug,
  base.removal_date,
  base.replacement_model_slug,
  base.license,
  base.license_url,
  'free',
  base.model_slug
from free_bases free
join public.v2_models base on base.model_slug = free.base_model_slug
on conflict (model_slug) do update set
  name = excluded.name,
  variant_kind = excluded.variant_kind,
  base_model_slug = excluded.base_model_slug,
  metadata = public.v2_models.metadata || jsonb_build_object(
    'variant_kind', 'free',
    'base_model_slug', excluded.base_model_slug,
    'derived_from_provider_json', true
  ),
  updated_at = now();

update public.v2_model_provider_routes route
set model_slug = route.model_slug || ':free',
    updated_at = now()
where lower(route.provider_model_id) like '%:free'
  and lower(route.model_slug) not like '%:free'
  and exists (
    select 1
    from public.v2_models model
    where model.model_slug = route.model_slug || ':free'
  );

-- Provider API IDs that differ from the canonical base spelling remain valid
-- inputs, but resolve directly to the free canonical model rather than the
-- paid/base row.
insert into public.v2_model_aliases (
  alias_slug,
  model_slug,
  alias_type,
  enabled,
  metadata
)
select distinct
  lower(substring(route.provider_model_id from position(':' in route.provider_model_id) + 1)),
  route.model_slug,
  'provider',
  true,
  jsonb_build_object(
    'source', 'v2_free_variant_backfill',
    'provider_model_id', route.provider_model_id,
    'free_variant_alias', true
  )
from public.v2_model_provider_routes route
where lower(route.provider_model_id) like '%:free'
  and route.model_slug like '%:free'
  and lower(substring(route.provider_model_id from position(':' in route.provider_model_id) + 1)) <> route.model_slug
on conflict (alias_slug) do update set
  model_slug = excluded.model_slug,
  alias_type = excluded.alias_type,
  enabled = true,
  metadata = excluded.metadata,
  updated_at = now();

-- Route identity is authoritative for the model actually executed.
update public.v2_request_facts fact
set routed_model_slug = route.model_slug,
    requested_model_slug = case
      when lower(fact.requested_model_input) like '%:free' then route.model_slug
      else fact.requested_model_slug
    end
from public.v2_model_provider_routes route
where fact.provider_model_id = route.provider_model_id
  and route.model_slug like '%:free'
  and (
    fact.routed_model_slug is distinct from route.model_slug
    or (
      lower(fact.requested_model_input) like '%:free'
      and fact.requested_model_slug is distinct from route.model_slug
    )
  );

update public.v2_private_usage_daily rollup
set model_slug = route.model_slug,
    updated_at = now()
from public.v2_model_provider_routes route
where rollup.provider_model_id = route.provider_model_id
  and route.model_slug like '%:free'
  and rollup.model_slug is distinct from route.model_slug;

update public.v2_public_usage_daily rollup
set model_slug = route.model_slug,
    updated_at = now()
from public.v2_model_provider_routes route
where rollup.provider_model_id = route.provider_model_id
  and route.model_slug like '%:free'
  and rollup.model_slug is distinct from route.model_slug;

update public.v2_public_usage_hourly rollup
set model_slug = route.model_slug,
    updated_at = now()
from public.v2_model_provider_routes route
where rollup.provider_model_id = route.provider_model_id
  and route.model_slug like '%:free'
  and rollup.model_slug is distinct from route.model_slug;

update public.v2_public_provider_health_daily health
set model_slug = route.model_slug,
    updated_at = now()
from public.v2_model_provider_routes route
where health.provider_model_id = route.provider_model_id
  and route.model_slug like '%:free'
  and health.model_slug is distinct from route.model_slug;

-- Any exact provider route repaired on an attempt also repairs the logical
-- request's routed model. This keeps future free telemetry separated even if a
-- caller supplied the base model as its routed-model hint.
create or replace function public.sync_v2_request_fact_provider_model_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider_model_id is not null then
    update public.v2_request_facts request
    set provider_model_id = new.provider_model_id,
        routed_model_slug = route.model_slug,
        requested_model_slug = case
          when lower(request.requested_model_input) like '%:free' then route.model_slug
          else request.requested_model_slug
        end
    from public.v2_model_provider_routes route
    where route.provider_model_id = new.provider_model_id
      and request.request_event_id = new.request_event_id
      and (
        request.provider_model_id is distinct from new.provider_model_id
        or request.routed_model_slug is distinct from route.model_slug
        or (
          lower(request.requested_model_input) like '%:free'
          and request.requested_model_slug is distinct from route.model_slug
        )
      );
  end if;
  return new;
end;
$$;

create or replace function public.get_v2_model_identity(p_model_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'model_slug', model.model_slug,
    'name', model.name,
    'description', model.description,
    'status', model.status,
    'hidden', model.hidden,
    'variant_kind', model.variant_kind,
    'base_model_slug', model.base_model_slug,
    'previous_model_slug', model.previous_model_slug,
    'replacement_model_slug', model.replacement_model_slug,
    'announced_at', model.announced_at,
    'released_at', model.released_at,
    'deprecated_at', model.deprecated_at,
    'retired_at', model.retired_at,
    'removal_date', model.removal_date,
    'family_slug', model.family_slug,
    'license', model.license,
    'license_url', model.license_url,
    'lab_slug', lab.lab_slug,
    'lab_name', lab.name,
    'lab_country_code', lab.country_code
  )
  from public.v2_models model
  join public.v2_labs lab on lab.lab_slug = model.lab_slug
  where model.model_slug = lower(trim(p_model_slug))
    and model.hidden = false
    and model.status <> 'disabled';
$$;

grant execute on function public.get_v2_model_identity(text)
  to anon, authenticated, service_role;

comment on column public.v2_models.variant_kind is
  'Canonical offer variant. Free provider offers are separate model identities rather than service-tier flags on the paid/base model.';
comment on column public.v2_models.base_model_slug is
  'Base canonical model whose static metadata this variant inherits.';
