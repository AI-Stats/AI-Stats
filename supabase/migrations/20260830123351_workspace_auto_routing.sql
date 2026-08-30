alter table public.workspace_settings
  add column if not exists auto_routing_enabled boolean not null default false,
  add column if not exists auto_routing_model_ids text[] not null default '{}'::text[],
  add column if not exists auto_routing_objective text not null default 'balanced',
  add column if not exists auto_routing_fallbacks_enabled boolean not null default true,
  add column if not exists auto_routing_revision uuid not null default gen_random_uuid(),
  add column if not exists auto_routing_updated_at timestamptz not null default now();

alter table public.workspace_settings
  drop constraint if exists workspace_settings_auto_routing_objective_valid,
  add constraint workspace_settings_auto_routing_objective_valid
    check (auto_routing_objective in ('balanced', 'quality', 'cost', 'latency')),
  drop constraint if exists workspace_settings_auto_routing_model_count_valid,
  add constraint workspace_settings_auto_routing_model_count_valid
    check (
      cardinality(auto_routing_model_ids) <= 8
      and (
        auto_routing_enabled = false
        or cardinality(auto_routing_model_ids) between 2 and 8
      )
    ),
  drop constraint if exists workspace_settings_auto_routing_no_virtual_model,
  add constraint workspace_settings_auto_routing_no_virtual_model
    check (not ('phaseo/auto' = any(auto_routing_model_ids)));

comment on column public.workspace_settings.auto_routing_model_ids is
  'Explicit canonical model pool used when requests select phaseo/auto.';
comment on column public.workspace_settings.auto_routing_revision is
  'Immutable revision identifier replaced whenever the auto-routing configuration changes.';
