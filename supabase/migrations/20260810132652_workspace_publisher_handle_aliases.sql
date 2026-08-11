create table public.workspace_publisher_handle_aliases (
  handle text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint workspace_publisher_handle_alias_format
    check (handle ~ '^[a-z0-9][a-z0-9_-]{2,39}$')
);

create index workspace_publisher_handle_aliases_workspace_idx
  on public.workspace_publisher_handle_aliases (workspace_id, created_at desc);

alter table public.workspace_publisher_handle_aliases enable row level security;
revoke all on table public.workspace_publisher_handle_aliases from public, anon, authenticated;
grant all on table public.workspace_publisher_handle_aliases to service_role;

comment on table public.workspace_publisher_handle_aliases is
  'Permanent historical workspace publisher handles used for redirects and preset resolution.';

create or replace function public.prevent_reserved_workspace_publisher_handle()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  new.publisher_handle := lower(trim(new.publisher_handle));
  if exists (
    select 1 from public.workspace_publisher_handle_aliases alias
    where alias.handle = new.publisher_handle
      and alias.workspace_id <> new.id
  ) then
    raise exception 'publisher_handle_reserved' using errcode = '23505';
  end if;
  return new;
end
$function$;

revoke all on function public.prevent_reserved_workspace_publisher_handle() from public, anon, authenticated;

drop trigger if exists workspaces_prevent_reserved_publisher_handle on public.workspaces;
create trigger workspaces_prevent_reserved_publisher_handle
before insert or update of publisher_handle on public.workspaces
for each row execute function public.prevent_reserved_workspace_publisher_handle();

create or replace function public.rename_workspace_publisher_handle(
  target_workspace_id uuid,
  actor_user_id uuid,
  requested_handle text
)
returns text
language plpgsql
security invoker
set search_path = public
as $function$
declare
  workspace_row public.workspaces%rowtype;
  normalized_handle text := lower(trim(requested_handle));
begin
  if normalized_handle !~ '^[a-z0-9][a-z0-9_-]{2,39}$' then
    raise exception 'invalid_publisher_handle';
  end if;

  select * into workspace_row
  from public.workspaces
  where id = target_workspace_id
  for update;
  if not found then raise exception 'workspace_not_found'; end if;

  if workspace_row.owner_user_id <> actor_user_id and not exists (
    select 1 from public.workspace_members member
    where member.workspace_id = target_workspace_id
      and member.user_id = actor_user_id
      and member.role in ('owner', 'admin')
  ) then
    raise exception 'publisher_handle_forbidden';
  end if;

  if normalized_handle = workspace_row.publisher_handle then
    return normalized_handle;
  end if;

  if exists (
    select 1 from public.workspaces workspace
    where lower(workspace.publisher_handle) = normalized_handle
      and workspace.id <> target_workspace_id
  ) or exists (
    select 1 from public.workspace_publisher_handle_aliases alias
    where alias.handle = normalized_handle
      and alias.workspace_id <> target_workspace_id
  ) then
    raise exception 'publisher_handle_reserved' using errcode = '23505';
  end if;

  insert into public.workspace_publisher_handle_aliases (handle, workspace_id)
  values (workspace_row.publisher_handle, target_workspace_id)
  on conflict (handle) do nothing;

  -- phaseo:allow-destructive-migration reason: Remove a same-workspace alias when that handle becomes canonical so preset resolution remains unambiguous.
  delete from public.workspace_publisher_handle_aliases
  where workspace_id = target_workspace_id and handle = normalized_handle;

  update public.workspaces
  set publisher_handle = normalized_handle
  where id = target_workspace_id;

  return normalized_handle;
end
$function$;

revoke all on function public.rename_workspace_publisher_handle(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.rename_workspace_publisher_handle(uuid, uuid, text) to service_role;

-- Keep historical qualified preset names working while returning the current
-- canonical publisher handle in gateway request context.
do $migration$
declare
  definition text;
  patched text;
begin
  select pg_get_functiondef(
    'public.gateway_fetch_request_context(uuid,text,text,uuid)'::regprocedure
  ) into definition;

  patched := replace(
    definition,
    'and lower(w.publisher_handle) = lower(preset_publisher)',
    'and (lower(w.publisher_handle) = lower(preset_publisher) or exists (select 1 from public.workspace_publisher_handle_aliases alias where alias.workspace_id = w.id and alias.handle = lower(preset_publisher)))'
  );

  if patched = definition then
    raise exception 'could not add workspace publisher alias resolution';
  end if;
  execute patched;
end
$migration$;

comment on function public.gateway_fetch_request_context(uuid, text, text, uuid)
  is 'V2 gateway request context with current and historical workspace publisher handle resolution.';
