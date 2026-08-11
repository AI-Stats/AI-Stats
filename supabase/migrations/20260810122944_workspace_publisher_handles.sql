alter table public.workspaces
  add column if not exists publisher_handle text;

update public.workspaces
set publisher_handle = lower(regexp_replace(regexp_replace(coalesce(nullif(slug, ''), name), '[^a-zA-Z0-9_-]+', '-', 'g'), '^-+|-+$', '', 'g'))
where nullif(publisher_handle, '') is null;

update public.workspaces
set publisher_handle = 'workspace-' || left(id::text, 8)
where length(publisher_handle) < 3;

-- Resolve any historical collisions deterministically before enforcing the
-- global marketplace namespace.
with duplicates as (
  select id, row_number() over (
    partition by lower(publisher_handle)
    order by created_at, id
  ) as position
  from public.workspaces
  where nullif(publisher_handle, '') is not null
)
update public.workspaces w
set publisher_handle = left(w.publisher_handle, 30) || '-' || left(w.id::text, 8)
from duplicates d
where w.id = d.id and d.position > 1;

alter table public.workspaces
  alter column publisher_handle set not null;

alter table public.workspaces
  drop constraint if exists workspaces_publisher_handle_format;
alter table public.workspaces
  add constraint workspaces_publisher_handle_format
  check (publisher_handle ~ '^[a-z0-9][a-z0-9_-]{2,39}$');

create unique index if not exists workspaces_publisher_handle_key
  on public.workspaces (lower(publisher_handle));

comment on column public.workspaces.publisher_handle is
  'Globally unique marketplace namespace used by public workspace resources.';

create or replace function public.default_workspace_publisher_handle()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  if nullif(new.publisher_handle, '') is null then
    new.publisher_handle := lower(regexp_replace(regexp_replace(coalesce(nullif(new.slug, ''), new.name), '[^a-zA-Z0-9_-]+', '-', 'g'), '^-+|-+$', '', 'g'));
    if length(new.publisher_handle) < 3 then
      new.publisher_handle := 'workspace-' || left(new.id::text, 8);
    end if;
  end if;
  return new;
end
$function$;

drop trigger if exists workspaces_default_publisher_handle on public.workspaces;
create trigger workspaces_default_publisher_handle
before insert on public.workspaces
for each row execute function public.default_workspace_publisher_handle();

revoke all on function public.default_workspace_publisher_handle() from public;

drop index if exists public.presets_public_publisher_slug_key;
create unique index if not exists presets_public_workspace_slug_key
  on public.presets (workspace_id, lower(slug))
  where visibility = 'public';

comment on index public.presets_public_workspace_slug_key is
  'Public preset slugs are unique within their workspace publisher namespace.';

-- Patch the installed V2 gateway context function so qualified preset names
-- resolve through workspace publisher handles instead of personal profiles.
do $migration$
declare
  definition text;
  patched text;
begin
  select pg_get_functiondef(
    'public.gateway_fetch_request_context(uuid,text,text,uuid)'::regprocedure
  ) into definition;

  if position('join public.users u on u.user_id = p.created_by' in definition) = 0
    or position('u.public_profile_enabled = true' in definition) = 0
  then
    raise exception 'could not find personal publisher preset lookup';
  end if;

  patched := replace(definition,
    'join public.users u on u.user_id = p.created_by',
    'join public.workspaces w on w.id = p.workspace_id');
  patched := replace(patched,
    '''publisher'', u.public_profile_slug',
    '''publisher'', w.publisher_handle');
  patched := replace(patched,
    'and u.public_profile_enabled = true',
    'and true');
  patched := replace(patched,
    'and lower(u.public_profile_slug) = lower(preset_publisher)',
    'and lower(w.publisher_handle) = lower(preset_publisher)');

  if patched = definition
    or position('u.public_profile_slug' in patched) > 0
    or position('u.public_profile_enabled' in patched) > 0
  then
    raise exception 'could not patch workspace publisher preset lookup';
  end if;

  execute patched;
end
$migration$;

comment on function public.gateway_fetch_request_context(uuid, text, text, uuid)
  is 'V2 gateway request context with workspace-local and workspace-publisher-qualified preset resolution.';
