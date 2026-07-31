-- Carry per-request included quantities from V2 meter metadata into gateway
-- pricing cards and the model-pricing catalogue projection.

do $migration$
declare
  definition text;
  old_select text := 'meter.price_nanos / 1000000000.0 as price_per_unit, sku.currency';
  new_select text := 'meter.price_nanos / 1000000000.0 as price_per_unit, coalesce(nullif(meter.metadata->>''included_quantity'', '''')::numeric, nullif(sku.metadata->>''included_quantity'', '''')::numeric, 0) as included_quantity, sku.currency';
  old_payload text := '''price_per_unit'', r.price_per_unit,' || chr(10) || '                  ''currency'', r.currency,';
  new_payload text := '''price_per_unit'', r.price_per_unit,' || chr(10) || '                  ''included_quantity'', r.included_quantity,' || chr(10) || '                  ''currency'', r.currency,';
begin
  select pg_get_functiondef(
    'public.gateway_fetch_request_context(uuid,text,text,uuid)'::regprocedure
  ) into definition;

  if position(old_select in definition) > 0 then
    definition := replace(definition, old_select, new_select);
  elsif position(new_select in definition) = 0 then
    raise exception 'Gateway context pricing included-quantity projection has an unexpected definition';
  end if;

  if position(old_payload in definition) > 0 then
    definition := replace(definition, old_payload, new_payload);
  elsif position(new_payload in definition) = 0 then
    raise exception 'Gateway context pricing included-quantity payload has an unexpected definition';
  end if;

  execute definition;
end
$migration$;

do $migration$
declare
  definition text;
  old_payload text := '''price_per_unit'', meter.price_nanos / 1000000000.0,' || chr(10) || '          ''currency'', sku.currency,';
  new_payload text := '''price_per_unit'', meter.price_nanos / 1000000000.0,' || chr(10) || '          ''included_quantity'', coalesce(nullif(meter.metadata->>''included_quantity'', '''')::numeric, nullif(sku.metadata->>''included_quantity'', '''')::numeric, 0),' || chr(10) || '          ''currency'', sku.currency,';
begin
  select pg_get_functiondef(
    'public.get_v2_model_pricing(text,text,text)'::regprocedure
  ) into definition;

  if position(old_payload in definition) > 0 then
    definition := replace(definition, old_payload, new_payload);
    execute definition;
  elsif position(new_payload in definition) = 0 then
    raise exception 'Model pricing included-quantity payload has an unexpected definition';
  end if;
end
$migration$;
