-- Immutable preset releases, pinned upstream updates, and complete fork lineage.

alter table public.presets
  add column if not exists draft_name text,
  add column if not exists draft_slug text,
  add column if not exists draft_description text,
  add column if not exists draft_config jsonb,
  add column if not exists draft_visibility text,
  add column if not exists active_version_id uuid,
  add column if not exists source_preset_version_id uuid,
  add column if not exists upstream_version_id uuid,
  add column if not exists root_preset_id uuid,
  add column if not exists fork_depth integer not null default 0,
  add column if not exists archived_at timestamptz;

create table if not exists public.preset_versions (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references public.presets(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  name text not null,
  slug text not null,
  description text,
  config jsonb not null default '{}'::jsonb,
  visibility text not null check (visibility in ('private', 'team', 'public')),
  release_notes text,
  created_by uuid not null references public.users(user_id),
  created_at timestamptz not null default now(),
  unique (preset_id, version_number)
);

create index if not exists preset_versions_preset_created_idx
  on public.preset_versions (preset_id, version_number desc);

insert into public.preset_versions (
  preset_id, version_number, name, slug, description, config, visibility, created_by, created_at
)
select p.id, 1, p.name, coalesce(nullif(p.slug, ''), regexp_replace(p.name, '^@', '')),
  p.description, p.config, p.visibility, p.created_by, p.created_at
from public.presets p
where not exists (select 1 from public.preset_versions v where v.preset_id = p.id);

update public.presets p set
  draft_name = coalesce(p.draft_name, p.name),
  draft_slug = coalesce(p.draft_slug, p.slug),
  draft_description = coalesce(p.draft_description, p.description),
  draft_config = coalesce(p.draft_config, p.config),
  draft_visibility = coalesce(p.draft_visibility, p.visibility),
  active_version_id = coalesce(p.active_version_id, (
    select v.id from public.preset_versions v where v.preset_id = p.id order by v.version_number desc limit 1
  ));

alter table public.presets
  add constraint presets_active_version_fkey foreign key (active_version_id) references public.preset_versions(id) on delete set null,
  add constraint presets_source_version_fkey foreign key (source_preset_version_id) references public.preset_versions(id) on delete set null,
  add constraint presets_upstream_version_fkey foreign key (upstream_version_id) references public.preset_versions(id) on delete set null,
  add constraint presets_root_preset_fkey foreign key (root_preset_id) references public.presets(id) on delete set null;

with recursive lineage as (
  select p.id, p.id as root_id, 0 as depth, array[p.id] as path
  from public.presets p where p.source_preset_id is null
  union all
  select child.id, parent.root_id, parent.depth + 1, parent.path || child.id
  from lineage parent join public.presets child on child.source_preset_id = parent.id
  where not child.id = any(parent.path)
)
update public.presets p set root_preset_id = l.root_id, fork_depth = l.depth
from lineage l where l.id = p.id;

update public.presets p set
  root_preset_id = coalesce(p.root_preset_id, p.id),
  source_preset_version_id = coalesce(p.source_preset_version_id, source.active_version_id),
  upstream_version_id = coalesce(p.upstream_version_id, source.active_version_id)
from public.presets source where source.id = p.source_preset_id;

update public.presets set root_preset_id = id where root_preset_id is null;

create table if not exists public.preset_lineage (
  ancestor_preset_id uuid not null references public.presets(id) on delete cascade,
  descendant_preset_id uuid not null references public.presets(id) on delete cascade,
  depth integer not null check (depth >= 0),
  primary key (ancestor_preset_id, descendant_preset_id)
);

create index if not exists preset_lineage_descendant_idx
  on public.preset_lineage (descendant_preset_id, depth);

with recursive ancestry as (
  select p.id as ancestor_id, p.id as descendant_id, 0 as depth, array[p.id] as path
  from public.presets p
  union all
  select ancestry.ancestor_id, child.id, ancestry.depth + 1, ancestry.path || child.id
  from ancestry join public.presets child on child.source_preset_id = ancestry.descendant_id
  where not child.id = any(ancestry.path)
)
insert into public.preset_lineage (ancestor_preset_id, descendant_preset_id, depth)
select ancestor_id, descendant_id, min(depth) from ancestry group by ancestor_id, descendant_id
on conflict do nothing;

create or replace function public.prepare_preset_lineage()
returns trigger language plpgsql security definer set search_path = public as $function$
declare source_row public.presets%rowtype;
begin
  if new.source_preset_id is null then
    new.root_preset_id := new.id;
    new.fork_depth := 0;
    return new;
  end if;
  select * into source_row from public.presets where id = new.source_preset_id;
  if not found then raise exception 'source_preset_not_found'; end if;
  new.root_preset_id := coalesce(source_row.root_preset_id, source_row.id);
  new.fork_depth := source_row.fork_depth + 1;
  new.source_preset_version_id := coalesce(new.source_preset_version_id, source_row.active_version_id);
  new.upstream_version_id := coalesce(new.upstream_version_id, source_row.active_version_id);
  return new;
end $function$;

create or replace function public.finish_preset_creation()
returns trigger language plpgsql security definer set search_path = public as $function$
declare initial_version_id uuid;
begin
  insert into public.preset_lineage values (new.id, new.id, 0) on conflict do nothing;
  if new.source_preset_id is not null then
    insert into public.preset_lineage (ancestor_preset_id, descendant_preset_id, depth)
    select ancestor_preset_id, new.id, depth + 1 from public.preset_lineage
    where descendant_preset_id = new.source_preset_id on conflict do nothing;
  end if;
  insert into public.preset_versions (preset_id, version_number, name, slug, description, config, visibility, created_by)
  values (new.id, 1, new.name, new.slug, new.description, new.config, new.visibility, new.created_by)
  returning id into initial_version_id;
  update public.presets set
    draft_name = new.name, draft_slug = new.slug, draft_description = new.description,
    draft_config = new.config, draft_visibility = new.visibility, active_version_id = initial_version_id
  where id = new.id;
  return new;
end $function$;

drop trigger if exists presets_prepare_lineage on public.presets;
create trigger presets_prepare_lineage before insert on public.presets
for each row execute function public.prepare_preset_lineage();
drop trigger if exists presets_finish_creation on public.presets;
create trigger presets_finish_creation after insert on public.presets
for each row execute function public.finish_preset_creation();

create or replace function public.publish_preset_version(target_preset_id uuid, actor_user_id uuid, notes text default null)
returns public.preset_versions language plpgsql security definer set search_path = public as $function$
declare p public.presets%rowtype; next_number integer; published public.preset_versions%rowtype;
begin
  select * into p from public.presets where id = target_preset_id and archived_at is null for update;
  if not found then raise exception 'preset_not_found'; end if;
  if p.created_by <> actor_user_id then raise exception 'preset_publish_forbidden'; end if;
  select coalesce(max(version_number), 0) + 1 into next_number from public.preset_versions where preset_id = p.id;
  insert into public.preset_versions (preset_id, version_number, name, slug, description, config, visibility, release_notes, created_by)
  values (p.id, next_number, p.draft_name, p.draft_slug, p.draft_description, p.draft_config, p.draft_visibility, nullif(trim(notes), ''), actor_user_id)
  returning * into published;
  update public.presets set name = published.name, slug = published.slug, description = published.description,
    config = published.config, visibility = published.visibility, active_version_id = published.id, updated_at = now()
  where id = p.id;
  return published;
end $function$;

create or replace function public.apply_preset_upstream_version(target_preset_id uuid, target_version_id uuid, actor_user_id uuid)
returns public.presets language plpgsql security definer set search_path = public as $function$
declare p public.presets%rowtype; upstream public.preset_versions%rowtype; updated public.presets%rowtype;
begin
  select * into p from public.presets where id = target_preset_id and archived_at is null for update;
  if not found or p.created_by <> actor_user_id then raise exception 'preset_update_forbidden'; end if;
  if p.source_preset_id is null then raise exception 'preset_has_no_upstream'; end if;
  select * into upstream from public.preset_versions where id = target_version_id and preset_id = p.source_preset_id;
  if not found then raise exception 'upstream_version_not_found'; end if;
  update public.presets set draft_name = upstream.name, draft_slug = upstream.slug,
    draft_description = upstream.description, draft_config = upstream.config,
    upstream_version_id = upstream.id, updated_at = now()
  where id = p.id returning * into updated;
  return updated;
end $function$;

drop function if exists public.marketplace_preset_fork_counts(uuid[]);
create function public.marketplace_preset_fork_counts(preset_ids uuid[])
returns table (preset_id uuid, direct_fork_count bigint, descendant_count bigint)
language sql stable security definer set search_path = public as $function$
  select requested.id,
    (select count(*) from public.presets direct where direct.source_preset_id = requested.id and direct.archived_at is null),
    (select count(*) from public.preset_lineage lineage join public.presets child on child.id = lineage.descendant_preset_id
      where lineage.ancestor_preset_id = requested.id and lineage.depth > 0 and child.archived_at is null)
  from unnest(preset_ids) requested(id);
$function$;

revoke all on function public.publish_preset_version(uuid, uuid, text) from public;
revoke all on function public.apply_preset_upstream_version(uuid, uuid, uuid) from public;
revoke all on function public.marketplace_preset_fork_counts(uuid[]) from public;
grant execute on function public.publish_preset_version(uuid, uuid, text) to service_role;
grant execute on function public.apply_preset_upstream_version(uuid, uuid, uuid) to service_role;
grant execute on function public.marketplace_preset_fork_counts(uuid[]) to anon, authenticated, service_role;

do $migration$
declare definition text; patched text;
begin
  select pg_get_functiondef('public.gateway_fetch_request_context(uuid,text,text,uuid)'::regprocedure) into definition;
  patched := replace(definition, 'where p.slug = preset_name', 'where p.archived_at is null and p.slug = preset_name');
  patched := replace(patched, 'where coalesce(nullif(p.slug, ''''), regexp_replace(p.name, ''^@'', '''')) = preset_name', 'where p.archived_at is null and coalesce(nullif(p.slug, ''''), regexp_replace(p.name, ''^@'', '''')) = preset_name');
  if patched = definition then raise exception 'could not add preset archival guard to gateway context'; end if;
  execute patched;
end $migration$;
