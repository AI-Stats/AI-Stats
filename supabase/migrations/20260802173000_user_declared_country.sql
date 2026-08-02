-- Capture a user's self-declared country during onboarding and provide a
-- structured home for provider-specific country restrictions.
--
-- This is intentionally separate from request-origin geography. Declared
-- country is account/compliance data; edge country remains analytics/risk data.

alter table public.users
  add column if not exists declared_country_code text,
  add column if not exists country_declared_at timestamptz;

alter table public.users
  drop constraint if exists users_declared_country_code_check;
alter table public.users
  add constraint users_declared_country_code_check
  check (
    declared_country_code is null
    or declared_country_code ~ '^[A-Z]{2}$'
  ) not valid;
alter table public.users
  validate constraint users_declared_country_code_check;

create index concurrently if not exists users_declared_country_code_idx
  on public.users (declared_country_code)
  where declared_country_code is not null;

comment on column public.users.declared_country_code is
  'ISO 3166-1 alpha-2 country explicitly selected by the user; separate from request-origin geography.';
comment on column public.users.country_declared_at is
  'Time at which the user most recently confirmed their declared country.';

create table if not exists public.v2_provider_country_restrictions (
  restriction_id uuid primary key default gen_random_uuid(),
  provider_slug text not null references public.v2_providers(provider_slug) on delete cascade,
  country_code text not null,
  reason text,
  source_url text,
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_provider_country_restrictions_country_check
    check (country_code ~ '^[A-Z]{2}$'),
  constraint v2_provider_country_restrictions_window_check
    check (expires_at is null or expires_at > effective_at),
  constraint v2_provider_country_restrictions_unique
    unique (provider_slug, country_code, effective_at)
);

create index if not exists v2_provider_country_restrictions_lookup_idx
  on public.v2_provider_country_restrictions (provider_slug, country_code, effective_at desc)
  where enabled;

alter table public.v2_provider_country_restrictions enable row level security;
revoke all on table public.v2_provider_country_restrictions from public, anon, authenticated;
grant select, insert, update, delete on table public.v2_provider_country_restrictions to service_role;

create or replace function public.is_provider_country_allowed(
  p_provider_slug text,
  p_country_code text,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select not exists (
    select 1
    from public.v2_provider_country_restrictions r
    where r.provider_slug = p_provider_slug
      and r.country_code = upper(p_country_code)
      and r.enabled
      and r.effective_at <= p_at
      and (r.expires_at is null or r.expires_at > p_at)
  );
$$;

revoke all on function public.is_provider_country_allowed(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.is_provider_country_allowed(text, text, timestamptz)
  to service_role;
