-- Historical ITL values were copied from request-level TPOT and were not
-- independently observed. Remove those estimates before storing measured
-- intervals between successive content-bearing provider stream frames.

update public.gateway_requests
set itl_ms = null
where itl_ms is not distinct from tpot_ms
  and itl_ms is not null;

update public.v2_request_facts
set itl_ms = null
where itl_ms is not distinct from tpot_ms
  and itl_ms is not null;

comment on column public.gateway_requests.itl_ms is
  'Mean observed interval in milliseconds between successive content-bearing provider stream frames.';

comment on column public.v2_request_facts.itl_ms is
  'Mean observed interval in milliseconds between successive content-bearing provider stream frames.';
