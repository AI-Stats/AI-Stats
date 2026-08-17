select pg_current_wal_lsn() as source_lsn;

select
  slot_name,
  active,
  restart_lsn,
  confirmed_flush_lsn,
  pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) as retained_or_unapplied_wal
from pg_catalog.pg_replication_slots
where slot_name like 'phaseo_from_supabase%';
