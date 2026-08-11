create table if not exists public.account_guardrail_settings (
  user_id uuid primary key references public.users(user_id) on delete cascade,
  privacy_enable_paid_may_train boolean not null default true,
  privacy_enable_free_may_train boolean not null default true,
  privacy_enable_input_output_logging boolean not null default true,
  privacy_zdr_only boolean not null default false,
  provider_restriction_mode text not null default 'none',
  provider_restriction_provider_ids text[] not null default '{}'::text[],
  model_restriction_mode text not null default 'none',
  model_restriction_model_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_guardrail_settings_provider_mode_valid check (provider_restriction_mode in ('none', 'allowlist', 'blocklist')),
  constraint account_guardrail_settings_model_mode_valid check (model_restriction_mode in ('none', 'allowlist', 'blocklist')),
  constraint account_guardrail_settings_provider_ids_valid check (array_position(provider_restriction_provider_ids, null) is null),
  constraint account_guardrail_settings_model_ids_valid check (array_position(model_restriction_model_ids, null) is null)
);

alter table public.account_guardrail_settings
  add column if not exists provider_restriction_mode text not null default 'none',
  add column if not exists provider_restriction_provider_ids text[] not null default '{}'::text[],
  add column if not exists model_restriction_mode text not null default 'none',
  add column if not exists model_restriction_model_ids text[] not null default '{}'::text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'account_guardrail_settings_provider_mode_valid') then
    alter table public.account_guardrail_settings add constraint account_guardrail_settings_provider_mode_valid check (provider_restriction_mode in ('none', 'allowlist', 'blocklist'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'account_guardrail_settings_model_mode_valid') then
    alter table public.account_guardrail_settings add constraint account_guardrail_settings_model_mode_valid check (model_restriction_mode in ('none', 'allowlist', 'blocklist'));
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'account_guardrail_settings' and column_name = 'blocked_provider_ids') then
    execute 'update public.account_guardrail_settings set provider_restriction_mode = ''blocklist'', provider_restriction_provider_ids = blocked_provider_ids where coalesce(array_length(blocked_provider_ids, 1), 0) > 0 and provider_restriction_mode = ''none''';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'account_guardrail_settings' and column_name = 'blocked_api_model_ids') then
    execute 'update public.account_guardrail_settings set model_restriction_mode = ''blocklist'', model_restriction_model_ids = blocked_api_model_ids where coalesce(array_length(blocked_api_model_ids, 1), 0) > 0 and model_restriction_mode = ''none''';
  end if;
end $$;

alter table public.account_guardrail_settings enable row level security;

revoke all on table public.account_guardrail_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.account_guardrail_settings to service_role;

comment on table public.account_guardrail_settings is
  'Minimum routing and data-handling policy applied to API keys owned by a user across workspaces.';

comment on column public.account_guardrail_settings.provider_restriction_provider_ids is
	'Canonical v2 provider slugs used by the selected account-level provider restriction mode.';

comment on column public.account_guardrail_settings.model_restriction_model_ids is
	'Canonical API model slugs used by the selected account-level model restriction mode.';
