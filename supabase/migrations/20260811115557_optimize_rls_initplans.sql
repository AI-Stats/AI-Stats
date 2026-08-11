-- Evaluate auth.uid() once per statement rather than once per candidate row.
-- The policy predicates and role/command assignments are preserved verbatim.

do $migration$
declare
  policy_row record;
  role_list text;
  using_expression text;
  check_expression text;
  policy_sql text;
begin
  for policy_row in
    select *
    from pg_policies
    where schemaname = 'public'
      and (tablename, policyname) in (
        values
          ('keys', 'Delete keys only owners/admins'),
          ('keys', 'Only insert for teams they are part of'),
          ('keys', 'Select keys for teams they are part of'),
          ('keys', 'Update keys only owners/admins'),
          ('users', 'team context can read requester/decider'),
          ('users', 'users can read self'),
          ('users', 'users_select_self'),
          ('users', 'users_update_self'),
          ('workspace_invites', 'team_invites: insert by owner'),
          ('workspace_members', 'team_members: self leave'),
          ('workspace_join_requests', 'team_join_requests_insert'),
          ('workspace_join_requests', 'team_join_requests_select'),
          ('workspace_join_requests', 'team_join_requests_update'),
          ('presets', 'presets_select_visible'),
          ('presets', 'presets_insert_owned'),
          ('presets', 'presets_update_owned'),
          ('presets', 'presets_delete_owned'),
          ('oauth_app_metadata', 'oauth_app_metadata_insert_own_team'),
          ('oauth_authorizations', 'oauth_authorizations_select_own'),
          ('oauth_authorizations', 'oauth_authorizations_delete_own'),
          ('oauth_authorizations', 'oauth_authorizations_update_own'),
          ('workspace_member_guardrails', 'workspace_member_guardrails_select_own_workspace'),
          ('workspace_member_guardrails', 'workspace_member_guardrails_insert_admin'),
          ('workspace_member_guardrails', 'workspace_member_guardrails_delete_admin'),
          ('gateway_webhook_endpoints', 'gateway_webhook_endpoints_select_workspace_members'),
          ('gateway_batch_requests', 'gateway_batch_requests_select_workspace_members'),
          ('workspaces', 'teams: read if member or owner')
      )
  loop
    select string_agg(role_name, ', ' order by role_name)
      into role_list
    from unnest(policy_row.roles) as roles(role_name);

    using_expression := case
      when policy_row.qual is null then null
      else regexp_replace(
        policy_row.qual,
        'auth[.]uid[[:space:]]*[(][[:space:]]*[)]',
        '(select auth.uid())',
        'gi'
      )
    end;
    check_expression := case
      when policy_row.with_check is null then null
      else regexp_replace(
        policy_row.with_check,
        'auth[.]uid[[:space:]]*[(][[:space:]]*[)]',
        '(select auth.uid())',
        'gi'
      )
    end;

    policy_sql := format(
      'drop policy if exists %I on %I.%I; create policy %I on %I.%I as %s for %s to %s',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename,
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename,
      policy_row.permissive,
      policy_row.cmd,
      role_list
    );

    if using_expression is not null then
      policy_sql := policy_sql || format(' using (%s)', using_expression);
    end if;
    if check_expression is not null then
      policy_sql := policy_sql || format(' with check (%s)', check_expression);
    end if;

    execute policy_sql;
  end loop;
end
$migration$;
