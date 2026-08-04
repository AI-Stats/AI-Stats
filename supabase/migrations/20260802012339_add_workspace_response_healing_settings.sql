alter table public.workspace_settings
  add column if not exists response_healing_enabled boolean not null default false,
  add column if not exists response_healing_locked boolean not null default false,
  add column if not exists response_healing_mode text not null default 'safe';

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.workspace_settings'::regclass
      and conname = 'workspace_settings_response_healing_mode_check'
  ) then
    alter table public.workspace_settings
      add constraint workspace_settings_response_healing_mode_check
      check (response_healing_mode in ('safe', 'strict'));
  end if;
end
$migration$;
