-- Self-serve provider onboarding and provider-account ownership.
--
-- These tables are workflow records. They do not make a provider routeable;
-- route publication remains governed by the existing v2 catalogue controls.

create table if not exists public.provider_onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  provider_slug text not null,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  provider_name text not null,
  website_url text not null,
  logo_url text,
  catalog_url text not null,
  status text not null default 'submitted',
  model_count integer not null default 0,
  catalog_sha256 text,
  catalog_preview jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_onboarding_submissions_status_check
    check (status in ('submitted', 'needs_action', 'staging', 'published', 'rejected', 'withdrawn')),
  constraint provider_onboarding_submissions_model_count_check
    check (model_count >= 0),
  constraint provider_onboarding_submissions_provider_slug_check
    check (provider_slug = lower(provider_slug) and provider_slug ~ '^[a-z0-9][a-z0-9._-]*$')
);

create index if not exists provider_onboarding_submissions_submitter_idx
  on public.provider_onboarding_submissions (submitted_by, created_at desc);
create index if not exists provider_onboarding_submissions_provider_idx
  on public.provider_onboarding_submissions (provider_slug, created_at desc);

create table if not exists public.provider_account_links (
  provider_slug text not null references public.v2_providers(provider_slug) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  linked_by uuid references auth.users(id) on delete set null,
  role text not null default 'owner',
  status text not null default 'pending',
  proof_method text not null default 'catalog_domain_match',
  proof_subject text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider_slug, workspace_id),
  constraint provider_account_links_role_check check (role in ('owner', 'admin', 'editor')),
  constraint provider_account_links_status_check check (status in ('pending', 'active', 'revoked'))
);

create unique index if not exists provider_account_links_one_active_owner_idx
  on public.provider_account_links (provider_slug)
  where status = 'active' and role = 'owner';
create unique index if not exists provider_account_links_one_active_provider_per_workspace_idx
  on public.provider_account_links (workspace_id)
  where status = 'active';

alter table public.provider_onboarding_submissions enable row level security;
alter table public.provider_account_links enable row level security;

revoke all on public.provider_onboarding_submissions from anon, authenticated;
revoke all on public.provider_account_links from anon, authenticated;

comment on table public.provider_onboarding_submissions is
  'Versioned self-serve provider catalog submissions. Submission state never implies route enablement.';
comment on table public.provider_account_links is
  'Provider-to-workspace ownership links. Individual access is inherited from workspace membership.';
