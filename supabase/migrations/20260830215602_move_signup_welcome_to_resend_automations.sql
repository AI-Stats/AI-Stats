-- Signup welcome email is owned by the event-triggered Resend Automation.
-- Keep the auth trigger's required public.users provisioning and best-effort
-- Discord notification, but remove the obsolete welcome/outbox naming.

do $migration$
begin
  if to_regprocedure('public.enqueue_welcome_email()') is not null
    and to_regprocedure('public.handle_auth_user_created()') is null then
    alter function public.enqueue_welcome_email()
      rename to handle_auth_user_created;
  end if;

  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_created_enqueue_welcome'
      and not tgisinternal
  ) and not exists (
    select 1
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_created'
      and not tgisinternal
  ) then
    alter trigger on_auth_user_created_enqueue_welcome on auth.users
      rename to on_auth_user_created;
  end if;

  if to_regprocedure('public.handle_auth_user_created()') is not null then
    comment on function public.handle_auth_user_created() is
      'Provision the public user row and emit the internal Discord signup notification.';
  end if;
end
$migration$;

-- Prevent historical rows from sending when the email outbox worker is enabled.
-- Keeping the rows preserves operational history without marking them as delivered.
update public.email_outbox
set attempts = greatest(attempts, 5),
    last_error = 'cancelled: signup welcome moved to Resend Automations'
where sent_at is null
  and (kind = 'welcome' or template = 'welcome');
