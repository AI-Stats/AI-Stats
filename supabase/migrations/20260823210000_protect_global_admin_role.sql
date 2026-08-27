-- Prevent authenticated profile updates from changing the global catalogue-admin role.
create or replace function public.protect_users_global_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role'
     and new.role is distinct from old.role then
    raise exception 'users.role is managed by administrators'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_users_global_role() from public, anon, authenticated;

drop trigger if exists protect_users_global_role on public.users;
create trigger protect_users_global_role
before update of role on public.users
for each row execute function public.protect_users_global_role();
