-- Keep authored rule priority in the public model-pricing projection. This
-- lets a higher-priority promotional rule be compared with the standard rate.

do $migration$
declare
  definition text;
  old_payload text := '''priority'', meter.meter_order,';
  new_payload text := '''priority'', coalesce(nullif(meter.metadata->>''priority'', '''')::integer, nullif(sku.metadata->>''priority'', '''')::integer, meter.meter_order, 100),';
begin
  select pg_get_functiondef(
    'public.get_v2_model_pricing(text,text,text)'::regprocedure
  ) into definition;

  definition := replace(definition, chr(13) || chr(10), chr(10));

  if position(old_payload in definition) > 0 then
    execute replace(definition, old_payload, new_payload);
  elsif position(new_payload in definition) = 0 then
    raise exception 'Model pricing priority projection has an unexpected definition';
  end if;
end
$migration$;
