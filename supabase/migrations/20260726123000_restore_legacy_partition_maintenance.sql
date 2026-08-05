-- The gateway still dual-writes the partitioned operational request table
-- during cutover. Keep its physical partition maintenance function intact;
-- analytical RPCs no longer read that table.
create or replace function public.ensure_gateway_requests_partitions(months_ahead integer default 1)
returns void
language plpgsql
as $$
declare
  v_cur_month timestamptz;
  v_last_month timestamptz;
  v_gateway_partition_name text;
  v_upstream_partition_name text;
begin
  if months_ahead is null or months_ahead < 0 then
    raise exception 'months_ahead must be >= 0';
  end if;

  v_cur_month := date_trunc('month', now());
  v_last_month := v_cur_month + make_interval(months => months_ahead);
  while v_cur_month <= v_last_month loop
    v_gateway_partition_name := format('gateway_requests_%s', to_char(v_cur_month, 'YYYY_MM'));
    execute format(
      'create table if not exists public.%I partition of public.gateway_requests for values from (%L) to (%L)',
      v_gateway_partition_name,
      v_cur_month,
      v_cur_month + interval '1 month'
    );
    v_upstream_partition_name := format('gateway_upstream_requests_%s', to_char(v_cur_month, 'YYYY_MM'));
    execute format(
      'create table if not exists public.%I partition of public.gateway_upstream_requests for values from (%L) to (%L)',
      v_upstream_partition_name,
      v_cur_month,
      v_cur_month + interval '1 month'
    );
    v_cur_month := v_cur_month + interval '1 month';
  end loop;
end;
$$;

comment on function public.ensure_gateway_requests_partitions(integer) is
  'Maintains physical legacy operational partitions while V2 dual-write remains enabled; not an analytical read path.';
