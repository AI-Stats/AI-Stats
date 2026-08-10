alter table public.workspace_settings
  add column if not exists model_restriction_mode text not null default 'none',
  add column if not exists model_restriction_model_ids text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_settings_model_restriction_mode_valid'
  ) then
    alter table public.workspace_settings
      add constraint workspace_settings_model_restriction_mode_valid
      check (model_restriction_mode in ('none', 'allowlist', 'blocklist'));
  end if;
end $$;

comment on column public.workspace_settings.model_restriction_model_ids is
  'Canonical API model slugs used by the workspace-wide model restriction mode.';
