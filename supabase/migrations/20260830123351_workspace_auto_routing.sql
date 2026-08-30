alter table public.workspace_settings
  add column if not exists auto_routing_allowed_patterns text[] not null default '{}'::text[],
  add column if not exists auto_routing_spend_profile text not null default 'standard',
  add column if not exists auto_routing_max_input_price_per_million numeric null,
  add column if not exists auto_routing_max_output_price_per_million numeric null,
  add column if not exists auto_routing_objective text not null default 'balanced',
  add column if not exists auto_routing_fallbacks_enabled boolean not null default true,
  add column if not exists auto_routing_revision uuid not null default gen_random_uuid(),
  add column if not exists auto_routing_updated_at timestamptz not null default now();

alter table public.workspace_settings
  drop constraint if exists workspace_settings_auto_routing_objective_valid,
  add constraint workspace_settings_auto_routing_objective_valid
    check (auto_routing_objective in ('balanced', 'quality', 'cost', 'latency')),
  drop constraint if exists workspace_settings_auto_routing_spend_profile_valid,
  add constraint workspace_settings_auto_routing_spend_profile_valid
    check (auto_routing_spend_profile in ('economy', 'standard', 'premium', 'unrestricted', 'custom')),
  drop constraint if exists workspace_settings_auto_routing_pattern_count_valid,
  add constraint workspace_settings_auto_routing_pattern_count_valid
    check (cardinality(auto_routing_allowed_patterns) <= 16),
  drop constraint if exists workspace_settings_auto_routing_custom_prices_valid,
  add constraint workspace_settings_auto_routing_custom_prices_valid
    check (
      auto_routing_spend_profile <> 'custom'
      or (
        auto_routing_max_input_price_per_million is not null
        and auto_routing_max_input_price_per_million >= 0
        and auto_routing_max_output_price_per_million is not null
        and auto_routing_max_output_price_per_million >= 0
      )
    );

comment on column public.workspace_settings.auto_routing_allowed_patterns is
  'Optional glob patterns that narrow the managed phaseo/auto text-model universe.';
comment on column public.workspace_settings.auto_routing_spend_profile is
  'Hard price-ceiling profile applied before phaseo/auto scores candidates.';
comment on column public.workspace_settings.auto_routing_revision is
  'Immutable revision identifier replaced whenever the auto-routing configuration changes.';
