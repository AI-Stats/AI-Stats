-- Canonical V2 catalogue extensions required for the hard V1 cutover.
-- Meter definitions are the small vocabulary (tokens, images, seconds, etc.).
-- v2_pricing_sku_meters remains the price-rate table joining an offer to a meter.

create table if not exists public.v2_meter_definitions (
  meter_key text primary key,
  display_name text not null,
  modality text not null,
  direction text,
  unit text not null,
  default_unit_quantity numeric(30, 12) not null default 1,
  description text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_meter_definitions_key_check
    check (meter_key = lower(meter_key) and meter_key ~ '^[a-z0-9][a-z0-9._:-]*$'),
  constraint v2_meter_definitions_direction_check
    check (direction is null or direction in ('input', 'output')),
  constraint v2_meter_definitions_quantity_check check (default_unit_quantity > 0),
  constraint v2_meter_definitions_status_check check (status in ('active', 'deprecated', 'disabled'))
);

insert into public.v2_meter_definitions (
  meter_key,
  display_name,
  modality,
  direction,
  unit,
  default_unit_quantity,
  metadata
)
select
  meter_key,
  min(display_label),
  min(modality),
  min(direction),
  min(unit),
  min(unit_quantity),
  jsonb_build_object('source', 'v2_pricing_sku_meters_backfill')
from public.v2_pricing_sku_meters
group by meter_key
on conflict (meter_key) do nothing;

alter table public.v2_pricing_sku_meters
  drop constraint if exists v2_pricing_sku_meters_meter_key_fkey;
alter table public.v2_pricing_sku_meters
  add constraint v2_pricing_sku_meters_meter_key_fkey
  foreign key (meter_key) references public.v2_meter_definitions(meter_key)
  on update cascade on delete restrict not valid;
alter table public.v2_pricing_sku_meters
  validate constraint v2_pricing_sku_meters_meter_key_fkey;

create index if not exists v2_meter_definitions_active_idx
  on public.v2_meter_definitions (modality, direction, meter_key)
  where status = 'active';

alter table public.v2_meter_definitions enable row level security;
drop policy if exists v2_meter_definitions_public_select on public.v2_meter_definitions;
create policy v2_meter_definitions_public_select on public.v2_meter_definitions
  for select to anon, authenticated using (status <> 'disabled');

grant select on public.v2_meter_definitions to anon, authenticated;
grant select, insert, update, delete on public.v2_meter_definitions to service_role;

comment on table public.v2_meter_definitions is
  'Canonical, small vocabulary of measurable usage dimensions. Price rates reference these definitions.';
comment on table public.v2_pricing_sku_meters is
  'Per-offer price rates. One SKU may contain multiple rates referencing canonical v2_meter_definitions.';

-- JSON-authored model content that previously lived in auxiliary V1 tables.
create table if not exists public.v2_model_links (
  model_slug text not null references public.v2_models(model_slug) on delete cascade,
  link_kind text not null,
  title text not null,
  url text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (model_slug, link_kind, url)
);

create table if not exists public.v2_model_details (
  model_slug text not null references public.v2_models(model_slug) on delete cascade,
  detail_name text not null,
  detail_value jsonb not null default 'null'::jsonb,
  detail_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (model_slug, detail_name)
);

create table if not exists public.v2_model_page_notices (
  model_slug text primary key references public.v2_models(model_slug) on delete cascade,
  tone text not null,
  markdown text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_model_page_notices_tone_check check (tone in ('info', 'warning', 'critical'))
);

create table if not exists public.v2_model_families (
  family_slug text primary key,
  lab_slug text not null references public.v2_labs(lab_slug) on delete cascade,
  name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lab_slug, family_slug)
);

create table if not exists public.v2_lab_links (
  lab_slug text not null references public.v2_labs(lab_slug) on delete cascade,
  platform text not null,
  url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (lab_slug, platform, url)
);

alter table public.v2_model_links enable row level security;
alter table public.v2_model_details enable row level security;
alter table public.v2_model_page_notices enable row level security;
alter table public.v2_model_families enable row level security;
alter table public.v2_lab_links enable row level security;

create policy v2_model_links_public_select on public.v2_model_links for select to anon, authenticated using (true);
create policy v2_model_details_public_select on public.v2_model_details for select to anon, authenticated using (true);
create policy v2_model_page_notices_public_select on public.v2_model_page_notices for select to anon, authenticated using (true);
create policy v2_model_families_public_select on public.v2_model_families for select to anon, authenticated using (true);
create policy v2_lab_links_public_select on public.v2_lab_links for select to anon, authenticated using (true);

grant select on public.v2_model_links, public.v2_model_details, public.v2_model_page_notices,
  public.v2_model_families, public.v2_lab_links to anon, authenticated;
grant select, insert, update, delete on public.v2_model_links, public.v2_model_details,
  public.v2_model_page_notices, public.v2_model_families, public.v2_lab_links to service_role;
