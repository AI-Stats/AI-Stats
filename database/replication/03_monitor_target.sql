select
  case srsubstate
    when 'i' then 'queued'
    when 'd' then 'copying'
    when 's' then 'catching_up'
    when 'r' then 'ready'
    else srsubstate::text
  end as state,
  count(*) as tables
from pg_catalog.pg_subscription_rel
group by srsubstate
order by srsubstate;

select
  subname,
  pid,
  received_lsn,
  latest_end_lsn,
  last_msg_send_time,
  last_msg_receipt_time,
  latest_end_time
from pg_catalog.pg_stat_subscription
where subname = 'phaseo_from_supabase';
