-- Public app URLs represent a logical app name, not a workspace-scoped row.
-- Multiple rows may therefore share the same slug (for example, Phaseo Chat
-- used by several workspaces).

drop trigger if exists assign_api_app_slug on public.api_apps;
drop index if exists public.api_apps_slug_key;

alter table public.api_apps
  drop constraint if exists api_apps_slug_format_check;

drop function if exists public.assign_api_app_slug();
drop function if exists public.api_app_slug_base(text, uuid);

alter table public.api_apps
  drop column if exists slug;

alter table public.api_apps
  add column slug text generated always as (
    coalesce(
      nullif(
        trim(both '-' from regexp_replace(lower(coalesce(title, '')), '[^a-z0-9]+', '-', 'g')),
        ''
      ),
      'app'
    )
  ) stored;

alter table public.api_apps
  add constraint api_apps_slug_format_check
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

create index api_apps_public_slug_idx
  on public.api_apps (slug, last_seen desc)
  where is_public = true and is_active = true;
