alter table public.broadcast_destination_keys
  add column if not exists filter_mode text not null default 'include';

update public.broadcast_destination_keys link
set filter_mode = destination.key_filter_mode
from public.workspace_broadcast_destinations destination
where destination.id = link.destination_id
  and destination.key_filter_mode in ('include', 'exclude');

alter table public.broadcast_destination_keys
  drop constraint if exists broadcast_destination_keys_filter_mode_check;
alter table public.broadcast_destination_keys
  add constraint broadcast_destination_keys_filter_mode_check
  check (filter_mode in ('include', 'exclude'));

alter table public.workspace_broadcast_destinations
  drop constraint if exists workspace_broadcast_destinations_key_filter_mode_check;
-- phaseo:allow-destructive-migration reason: Per-key filter modes have been backfilled above, so the obsolete destination-level column must be removed.
alter table public.workspace_broadcast_destinations
  drop column if exists key_filter_mode;
