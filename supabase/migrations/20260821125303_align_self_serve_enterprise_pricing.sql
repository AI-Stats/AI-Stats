alter table public.workspace_enterprise_quotes
  drop constraint if exists workspace_enterprise_quotes_member_count_check;

alter table public.workspace_enterprise_quotes
  add constraint workspace_enterprise_quotes_member_count_check
  check (member_count between 1 and 100000);

comment on column public.workspace_enterprise_quotes.member_count is
  'Quoted active-member capacity. New self-serve Enterprise quotes are validated by the application between 100 and 100,000 members; the database retains legacy quotes below the current minimum.';

create schema if not exists private;

create or replace function private.enforce_workspace_enterprise_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_limit integer;
  v_member_count bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('enterprise-member-limit:' || new.workspace_id::text, 0)
  );

  if exists (
    select 1
    from public.workspace_members member
    where member.workspace_id = new.workspace_id
      and member.user_id = new.user_id
  ) then
    return new;
  end if;

  select subscription.included_members
  into v_member_limit
  from public.workspace_addon_subscriptions subscription
  where subscription.workspace_id = new.workspace_id
    and subscription.addon_key = 'identity'
    and subscription.included_members is not null
    and (
      subscription.status in ('active', 'trialing')
      or (
        subscription.status = 'past_due'
        and subscription.grace_until is not null
        and subscription.grace_until > pg_catalog.now()
      )
    );

  if v_member_limit is null then
    return new;
  end if;

  select pg_catalog.count(*)
  into v_member_count
  from public.workspace_members member
  where member.workspace_id = new.workspace_id;

  if v_member_count >= v_member_limit then
    raise exception using
      errcode = '23514',
      message = 'workspace_enterprise_member_limit_reached',
      detail = pg_catalog.format(
        'This workspace has reached its Self Serve Enterprise limit of %s active members.',
        v_member_limit
      );
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_workspace_enterprise_member_limit() from public, anon, authenticated;

drop trigger if exists workspace_enterprise_member_limit_guard on public.workspace_members;
create trigger workspace_enterprise_member_limit_guard
before insert on public.workspace_members
for each row
execute function private.enforce_workspace_enterprise_member_limit();
