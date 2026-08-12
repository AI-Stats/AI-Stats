-- FOR ALL write policies also execute during SELECT. Split them into explicit
-- write operations so member reads evaluate only the SELECT policy.
drop policy if exists gateway_dynamic_routes_workspace_write on public.gateway_dynamic_routes;
create policy gateway_dynamic_routes_workspace_insert
  on public.gateway_dynamic_routes for insert to authenticated
  with check ((select public.is_workspace_admin(workspace_id)));
create policy gateway_dynamic_routes_workspace_update
  on public.gateway_dynamic_routes for update to authenticated
  using ((select public.is_workspace_admin(workspace_id)))
  with check ((select public.is_workspace_admin(workspace_id)));
create policy gateway_dynamic_routes_workspace_delete
  on public.gateway_dynamic_routes for delete to authenticated
  using ((select public.is_workspace_admin(workspace_id)));

drop policy if exists gateway_dynamic_route_versions_workspace_write on public.gateway_dynamic_route_versions;
create policy gateway_dynamic_route_versions_workspace_insert
  on public.gateway_dynamic_route_versions for insert to authenticated
  with check (
    exists (
      select 1
      from public.gateway_dynamic_routes route
      where route.id = gateway_dynamic_route_versions.route_id
        and (select public.is_workspace_admin(route.workspace_id))
    )
  );
create policy gateway_dynamic_route_versions_workspace_update
  on public.gateway_dynamic_route_versions for update to authenticated
  using (
    exists (
      select 1
      from public.gateway_dynamic_routes route
      where route.id = gateway_dynamic_route_versions.route_id
        and (select public.is_workspace_admin(route.workspace_id))
    )
  )
  with check (
    exists (
      select 1
      from public.gateway_dynamic_routes route
      where route.id = gateway_dynamic_route_versions.route_id
        and (select public.is_workspace_admin(route.workspace_id))
    )
  );
create policy gateway_dynamic_route_versions_workspace_delete
  on public.gateway_dynamic_route_versions for delete to authenticated
  using (
    exists (
      select 1
      from public.gateway_dynamic_routes route
      where route.id = gateway_dynamic_route_versions.route_id
        and (select public.is_workspace_admin(route.workspace_id))
    )
  );

drop policy if exists gateway_dynamic_route_keys_workspace_write on public.gateway_dynamic_route_keys;
create policy gateway_dynamic_route_keys_workspace_insert
  on public.gateway_dynamic_route_keys for insert to authenticated
  with check (
    exists (
      select 1
      from public.gateway_dynamic_routes route
      join public.keys gateway_key on gateway_key.id = gateway_dynamic_route_keys.key_id
      where route.id = gateway_dynamic_route_keys.route_id
        and gateway_key.workspace_id = route.workspace_id
        and (select public.is_workspace_admin(route.workspace_id))
    )
  );
create policy gateway_dynamic_route_keys_workspace_update
  on public.gateway_dynamic_route_keys for update to authenticated
  using (
    exists (
      select 1
      from public.gateway_dynamic_routes route
      where route.id = gateway_dynamic_route_keys.route_id
        and (select public.is_workspace_admin(route.workspace_id))
    )
  )
  with check (
    exists (
      select 1
      from public.gateway_dynamic_routes route
      join public.keys gateway_key on gateway_key.id = gateway_dynamic_route_keys.key_id
      where route.id = gateway_dynamic_route_keys.route_id
        and gateway_key.workspace_id = route.workspace_id
        and (select public.is_workspace_admin(route.workspace_id))
    )
  );
create policy gateway_dynamic_route_keys_workspace_delete
  on public.gateway_dynamic_route_keys for delete to authenticated
  using (
    exists (
      select 1
      from public.gateway_dynamic_routes route
      where route.id = gateway_dynamic_route_keys.route_id
        and (select public.is_workspace_admin(route.workspace_id))
    )
  );

-- Merge self and team-context reads into one authenticated policy. Anonymous
-- callers could not satisfy the previous auth.uid()-based PUBLIC policy.
drop policy if exists "team context can read requester/decider" on public.users;
drop policy if exists users_select_self on public.users;
create policy users_select_authorized_context
  on public.users
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.workspace_members my_membership
      join public.workspace_members other_membership
        on other_membership.workspace_id = my_membership.workspace_id
       and other_membership.user_id = users.user_id
      where my_membership.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.workspace_members my_membership
      join public.workspace_join_requests request
        on request.workspace_id = my_membership.workspace_id
       and request.requester_user_id = users.user_id
      where my_membership.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.workspace_members my_membership
      join public.workspace_join_requests request
        on request.workspace_id = my_membership.workspace_id
       and request.decided_by = users.user_id
      where my_membership.user_id = (select auth.uid())
    )
  );
