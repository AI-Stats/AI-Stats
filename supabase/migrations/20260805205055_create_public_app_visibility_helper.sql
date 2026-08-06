-- Define the RLS helper before the rollup policies in the immediately following
-- migration reference it. Keeping this separate preserves immutable migration
-- history while making fresh and replayed databases apply the hardening safely.
create or replace function public.is_public_api_app(p_app_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select app.is_public
    from public.api_apps app
    where app.id = p_app_id
  ), false);
$$;

revoke all on function public.is_public_api_app(uuid) from public;
grant execute on function public.is_public_api_app(uuid) to anon, authenticated, service_role;

comment on function public.is_public_api_app(uuid) is
  'RLS-safe public-app visibility lookup that exposes only a boolean classification.';
