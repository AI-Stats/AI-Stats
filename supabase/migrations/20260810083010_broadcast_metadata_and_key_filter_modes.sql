alter table public.workspace_broadcast_destinations
  add column if not exists key_filter_mode text not null default 'include',
  add column if not exists include_generation_metadata boolean not null default true,
  add column if not exists include_cost_metadata boolean not null default true,
  add column if not exists include_identity_metadata boolean not null default true,
  add column if not exists include_request_context boolean not null default true;

alter table public.workspace_broadcast_destinations
  drop constraint if exists workspace_broadcast_destinations_key_filter_mode_check;
alter table public.workspace_broadcast_destinations
  add constraint workspace_broadcast_destinations_key_filter_mode_check
  check (key_filter_mode in ('include', 'exclude'));

alter table public.broadcast_destination_rules
  drop constraint if exists broadcast_destination_rules_field_check;
alter table public.broadcast_destination_rules
  add constraint broadcast_destination_rules_field_check
  check (field in ('model','provider','session_id','user_id','api_key_name','finish_reason','input','output','token_cost','total_cost','total_tokens','prompt_tokens','completion_tokens'));
