-- Zero is a legacy placeholder, not a physically meaningful remote-stream
-- timing observation. Keep missing measurements nullable so percentile RPCs
-- do not interpret them as instantaneous responses.

update public.gateway_requests
set
  provider_ttft_ms = nullif(provider_ttft_ms, 0),
  gateway_ttft_ms = nullif(gateway_ttft_ms, 0),
  output_speed_tps = nullif(output_speed_tps, 0),
  tpot_ms = nullif(tpot_ms, 0),
  itl_ms = nullif(itl_ms, 0)
where
  provider_ttft_ms = 0 or gateway_ttft_ms = 0 or output_speed_tps = 0 or
  tpot_ms = 0 or itl_ms = 0;

update public.v2_request_facts
set
  provider_ttft_ms = nullif(provider_ttft_ms, 0),
  gateway_ttft_ms = nullif(gateway_ttft_ms, 0),
  output_speed_tps = nullif(output_speed_tps, 0),
  tpot_ms = nullif(tpot_ms, 0),
  itl_ms = nullif(itl_ms, 0)
where
  provider_ttft_ms = 0 or gateway_ttft_ms = 0 or output_speed_tps = 0 or
  tpot_ms = 0 or itl_ms = 0;

create or replace function public.copy_v2_performance_metrics_from_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  performance jsonb := coalesce(new.safe_metadata->'performance', '{}'::jsonb);
begin
  if performance ? 'provider_ttft_ms' then
    new.provider_ttft_ms := nullif(greatest(0, round(nullif(performance->>'provider_ttft_ms', '')::numeric)), 0)::integer;
  end if;
  if performance ? 'gateway_ttft_ms' then
    new.gateway_ttft_ms := nullif(greatest(0, round(nullif(performance->>'gateway_ttft_ms', '')::numeric)), 0)::integer;
  end if;
  if performance ? 'output_speed_tps' then
    new.output_speed_tps := nullif(greatest(0, nullif(performance->>'output_speed_tps', '')::numeric), 0);
  end if;
  if performance ? 'tpot_ms' then
    new.tpot_ms := nullif(greatest(0, nullif(performance->>'tpot_ms', '')::numeric), 0);
  end if;
  if performance ? 'itl_ms' then
    new.itl_ms := nullif(greatest(0, nullif(performance->>'itl_ms', '')::numeric), 0);
  end if;
  if performance ? 'phaseo_overhead_ms' then
    new.phaseo_overhead_ms := greatest(0, round(nullif(performance->>'phaseo_overhead_ms', '')::numeric))::integer;
  end if;
  return new;
end;
$$;
