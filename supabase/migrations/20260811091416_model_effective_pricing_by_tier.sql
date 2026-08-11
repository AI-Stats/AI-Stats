create table public.v2_public_effective_pricing_daily (
  model_slug text not null references public.v2_models(model_slug) on delete cascade,
  usage_date date not null,
  provider_id text not null,
  pricing_plan text not null default 'standard',
  input_tokens numeric(30, 12) not null default 0,
  output_tokens numeric(30, 12) not null default 0,
  cached_read_tokens numeric(30, 12) not null default 0,
  cached_write_tokens numeric(30, 12) not null default 0,
  input_cost_nanos numeric(30, 12) not null default 0,
  output_cost_nanos numeric(30, 12) not null default 0,
  total_cost_nanos numeric(30, 12) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (model_slug, usage_date, provider_id, pricing_plan),
  constraint v2_public_effective_pricing_daily_nonnegative check (
    input_tokens >= 0 and output_tokens >= 0 and
    cached_read_tokens >= 0 and cached_write_tokens >= 0 and
    input_cost_nanos >= 0 and output_cost_nanos >= 0 and total_cost_nanos >= 0
  )
);

create index v2_public_effective_pricing_daily_date_idx
  on public.v2_public_effective_pricing_daily (usage_date desc, model_slug);

alter table public.v2_public_effective_pricing_daily enable row level security;

create policy v2_public_effective_pricing_daily_select
  on public.v2_public_effective_pricing_daily
  for select
  to anon, authenticated
  using (true);

grant select on public.v2_public_effective_pricing_daily to anon, authenticated, service_role;

insert into public.v2_public_effective_pricing_daily (
  model_slug, usage_date, provider_id, pricing_plan,
  input_tokens, output_tokens, cached_read_tokens, cached_write_tokens,
  input_cost_nanos, output_cost_nanos, total_cost_nanos
)
select
  coalesce(fact.routed_model_slug, fact.requested_model_slug),
  fact.occurred_at::date,
  route.provider_slug,
  coalesce(sku.service_tier_slug, 'standard'),
  coalesce(sum(line.quantity) filter (where line.meter_key in (
    'input_tokens', 'input_text_tokens',
    'cached_read_tokens', 'cached_read_text_tokens', 'implicit_cached_input_text_tokens',
    'cached_write_tokens', 'cached_write_text_tokens',
    'cached_write_text_tokens_5m', 'cached_write_text_tokens_1h'
  )), 0),
  coalesce(sum(line.quantity) filter (where line.meter_key in ('output_tokens', 'output_text_tokens')), 0),
  coalesce(sum(line.quantity) filter (where line.meter_key in (
    'cached_read_tokens', 'cached_read_text_tokens', 'implicit_cached_input_text_tokens'
  )), 0),
  coalesce(sum(line.quantity) filter (where line.meter_key in (
    'cached_write_tokens', 'cached_write_text_tokens',
    'cached_write_text_tokens_5m', 'cached_write_text_tokens_1h'
  )), 0),
  coalesce(sum(line.charged_nanos) filter (where line.meter_key in (
    'input_tokens', 'input_text_tokens',
    'cached_read_tokens', 'cached_read_text_tokens', 'implicit_cached_input_text_tokens',
    'cached_write_tokens', 'cached_write_text_tokens',
    'cached_write_text_tokens_5m', 'cached_write_text_tokens_1h'
  )), 0),
  coalesce(sum(line.charged_nanos) filter (where line.meter_key in ('output_tokens', 'output_text_tokens')), 0),
  coalesce(sum(line.charged_nanos), 0)
from public.v2_request_pricing_lines line
join public.v2_request_facts fact on fact.request_event_id = line.request_event_id
join public.v2_model_provider_routes route on route.provider_model_id = fact.provider_model_id
left join public.v2_pricing_skus sku on sku.sku_id = line.sku_id
where coalesce(fact.routed_model_slug, fact.requested_model_slug) is not null
group by
  coalesce(fact.routed_model_slug, fact.requested_model_slug),
  fact.occurred_at::date,
  route.provider_slug,
  coalesce(sku.service_tier_slug, 'standard')
having sum(line.quantity) > 0;

create or replace function public.sync_v2_public_effective_pricing_daily()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_line public.v2_request_pricing_lines%rowtype;
  direction integer;
  target_model text;
  target_date date;
  target_provider text;
  target_plan text;
  is_input boolean;
  is_output boolean;
  is_cached_read boolean;
  is_cached_write boolean;
begin
  if tg_op = 'DELETE' then
    source_line := old;
    direction := -1;
  else
    source_line := new;
    direction := 1;
  end if;

  select
    coalesce(fact.routed_model_slug, fact.requested_model_slug),
    fact.occurred_at::date,
    route.provider_slug,
    coalesce(sku.service_tier_slug, 'standard')
  into target_model, target_date, target_provider, target_plan
  from public.v2_request_facts fact
  join public.v2_model_provider_routes route on route.provider_model_id = fact.provider_model_id
  left join public.v2_pricing_skus sku on sku.sku_id = source_line.sku_id
  where fact.request_event_id = source_line.request_event_id;

  if target_model is null or target_provider is null then return source_line; end if;

  is_cached_read := source_line.meter_key in (
    'cached_read_tokens', 'cached_read_text_tokens', 'implicit_cached_input_text_tokens'
  );
  is_cached_write := source_line.meter_key in (
    'cached_write_tokens', 'cached_write_text_tokens',
    'cached_write_text_tokens_5m', 'cached_write_text_tokens_1h'
  );
  is_input := source_line.meter_key in ('input_tokens', 'input_text_tokens') or is_cached_read or is_cached_write;
  is_output := source_line.meter_key in ('output_tokens', 'output_text_tokens');

  if direction = -1 then
    update public.v2_public_effective_pricing_daily set
      input_tokens = greatest(0, input_tokens - case when is_input then source_line.quantity else 0 end),
      output_tokens = greatest(0, output_tokens - case when is_output then source_line.quantity else 0 end),
      cached_read_tokens = greatest(0, cached_read_tokens - case when is_cached_read then source_line.quantity else 0 end),
      cached_write_tokens = greatest(0, cached_write_tokens - case when is_cached_write then source_line.quantity else 0 end),
      input_cost_nanos = greatest(0, input_cost_nanos - case when is_input then source_line.charged_nanos else 0 end),
      output_cost_nanos = greatest(0, output_cost_nanos - case when is_output then source_line.charged_nanos else 0 end),
      total_cost_nanos = greatest(0, total_cost_nanos - source_line.charged_nanos),
      updated_at = now()
    where model_slug = target_model
      and usage_date = target_date
      and provider_id = target_provider
      and pricing_plan = target_plan;
    return source_line;
  end if;

  insert into public.v2_public_effective_pricing_daily (
    model_slug, usage_date, provider_id, pricing_plan,
    input_tokens, output_tokens, cached_read_tokens, cached_write_tokens,
    input_cost_nanos, output_cost_nanos, total_cost_nanos
  ) values (
    target_model, target_date, target_provider, target_plan,
    case when is_input then source_line.quantity else 0 end,
    case when is_output then source_line.quantity else 0 end,
    case when is_cached_read then source_line.quantity else 0 end,
    case when is_cached_write then source_line.quantity else 0 end,
    case when is_input then source_line.charged_nanos else 0 end,
    case when is_output then source_line.charged_nanos else 0 end,
    source_line.charged_nanos
  )
  on conflict (model_slug, usage_date, provider_id, pricing_plan) do update set
    input_tokens = greatest(0, public.v2_public_effective_pricing_daily.input_tokens + excluded.input_tokens),
    output_tokens = greatest(0, public.v2_public_effective_pricing_daily.output_tokens + excluded.output_tokens),
    cached_read_tokens = greatest(0, public.v2_public_effective_pricing_daily.cached_read_tokens + excluded.cached_read_tokens),
    cached_write_tokens = greatest(0, public.v2_public_effective_pricing_daily.cached_write_tokens + excluded.cached_write_tokens),
    input_cost_nanos = greatest(0, public.v2_public_effective_pricing_daily.input_cost_nanos + excluded.input_cost_nanos),
    output_cost_nanos = greatest(0, public.v2_public_effective_pricing_daily.output_cost_nanos + excluded.output_cost_nanos),
    total_cost_nanos = greatest(0, public.v2_public_effective_pricing_daily.total_cost_nanos + excluded.total_cost_nanos),
    updated_at = now();

  return source_line;
end;
$$;

revoke all on function public.sync_v2_public_effective_pricing_daily() from public, anon, authenticated;

create trigger sync_v2_public_effective_pricing_daily
after insert or delete on public.v2_request_pricing_lines
for each row execute function public.sync_v2_public_effective_pricing_daily();

create or replace function public.get_v2_model_effective_pricing_daily(
  p_model_slug text,
  p_provider_ids text[] default null,
  p_since date default null,
  p_until date default null
)
returns table (
  day_bucket date,
  provider_id text,
  pricing_plan text,
  input_tokens numeric,
  output_tokens numeric,
  cached_read_tokens numeric,
  cached_write_tokens numeric,
  input_cost_nanos numeric,
  output_cost_nanos numeric,
  total_cost_nanos numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    usage.usage_date,
    usage.provider_id,
    usage.pricing_plan,
    usage.input_tokens,
    usage.output_tokens,
    usage.cached_read_tokens,
    usage.cached_write_tokens,
    usage.input_cost_nanos,
    usage.output_cost_nanos,
    usage.total_cost_nanos
  from public.v2_public_effective_pricing_daily usage
  where usage.model_slug = lower(trim(p_model_slug))
    and (p_provider_ids is null or usage.provider_id = any(p_provider_ids))
    and (p_since is null or usage.usage_date >= p_since)
    and (p_until is null or usage.usage_date <= p_until)
  order by usage.usage_date, usage.provider_id, usage.pricing_plan;
$$;

revoke all on function public.get_v2_model_effective_pricing_daily(text, text[], date, date) from public;
grant execute on function public.get_v2_model_effective_pricing_daily(text, text[], date, date) to anon, authenticated, service_role;

comment on table public.v2_public_effective_pricing_daily is
  'Public daily model pricing aggregates from charged request lines, separated by provider service tier.';
