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
update public.email_outbox
set attempts = greatest(attempts, 5),
    last_error = 'cancelled: signup welcome moved to Resend Automations'
where sent_at is null
  and (kind = 'welcome' or template = 'welcome');;


-- phaseo:allow-production-history-backfill reason: Restore the exact migration version already recorded in the production ledger.

