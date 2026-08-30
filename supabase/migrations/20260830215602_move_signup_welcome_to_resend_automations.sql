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

  if to_regprocedure('public.handle_auth_user_created()') is not null then
    comment on function public.handle_auth_user_created() is
      'Provision the public user row and emit the internal Discord signup notification.';
  end if;
end
$migration$;

-- auth.users is owned by Supabase's managed auth role, so the legacy trigger
-- label cannot be renamed by the migration role. Renaming the public function
-- above updates the trigger dependency and removes the obsolete behavior.

-- Prevent historical rows from sending when the email outbox worker is enabled.
-- Keeping the rows preserves operational history without marking them as delivered.
update public.email_outbox
set attempts = greatest(attempts, 5),
    last_error = 'cancelled: signup welcome moved to Resend Automations'
where sent_at is null
  and (kind = 'welcome' or template = 'welcome');
