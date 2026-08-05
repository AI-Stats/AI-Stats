-- Fork owners may only apply public versions from a currently public source preset.
create or replace function public.apply_preset_upstream_version(target_preset_id uuid, target_version_id uuid, actor_user_id uuid)
returns public.presets language plpgsql security definer set search_path = public as $function$
declare
  p public.presets%rowtype;
  source public.presets%rowtype;
  upstream public.preset_versions%rowtype;
  updated public.presets%rowtype;
begin
  select * into p from public.presets where id = target_preset_id and archived_at is null for update;
  if not found or p.created_by <> actor_user_id then raise exception 'preset_update_forbidden'; end if;
  if p.source_preset_id is null then raise exception 'preset_has_no_upstream'; end if;
  if p.draft_name is distinct from p.name
    or p.draft_slug is distinct from p.slug
    or p.draft_description is distinct from p.description
    or p.draft_config is distinct from p.config
    or p.draft_visibility is distinct from p.visibility
  then raise exception 'preset_has_local_draft_changes'; end if;

  select * into source from public.presets
  where id = p.source_preset_id and visibility = 'public' and archived_at is null;
  if not found then raise exception 'upstream_preset_not_public'; end if;

  select * into upstream from public.preset_versions
  where id = target_version_id and preset_id = source.id and visibility = 'public';
  if not found then raise exception 'upstream_version_not_public'; end if;

  update public.presets set draft_name = upstream.name, draft_slug = upstream.slug,
    draft_description = upstream.description, draft_config = upstream.config,
    upstream_version_id = upstream.id, updated_at = now()
  where id = p.id returning * into updated;
  return updated;
end $function$;

revoke all on function public.apply_preset_upstream_version(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_preset_upstream_version(uuid, uuid, uuid) to service_role;
