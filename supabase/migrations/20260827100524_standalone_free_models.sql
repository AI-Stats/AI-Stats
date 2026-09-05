-- Restore API-first model identities for free-only models.
-- phaseo:allow-destructive-migration reason: consolidate synthetic and stale model rows after migrating every retained foreign-key reference to the canonical standalone free identities
--
-- A free API model may stand alone. base_model_slug remains available for
-- providers that expose genuinely distinct standard and free offers, but it
-- is no longer required merely to satisfy the catalogue schema.

alter table public.v2_models
  drop constraint if exists v2_models_variant_identity_check,
  add constraint v2_models_variant_identity_check check (
    (variant_kind = 'standard' and model_slug !~ ':free$' and base_model_slug is null)
    or
    (
      variant_kind = 'free'
      and model_slug ~ ':free$'
      and (base_model_slug is null or base_model_slug <> model_slug)
    )
  );

comment on column public.v2_models.variant_kind is
  'Canonical API model kind. Free models may stand alone or optionally reference a related standard model.';
comment on column public.v2_models.base_model_slug is
  'Optional related standard model. It is not required for standalone free API models.';

-- Leanstral has only ever been offered as a free API model. Preserve the two
-- callable identities and move historical data away from synthetic base rows.

update public.v2_models
set base_model_slug = null,
    previous_model_slug = case
      when model_slug = 'mistral/leanstral-1.5:free' then 'mistral/leanstral:free'
      else previous_model_slug
    end,
    metadata = (metadata - 'base_model_slug') || jsonb_build_object(
      'variant_kind', 'free',
      'standalone_free_model', true
    ),
    updated_at = now()
where model_slug in ('mistral/leanstral:free', 'mistral/leanstral-1.5:free');

update public.v2_model_provider_routes
set model_slug = 'mistral/leanstral-1.5:free',
    updated_at = now()
where model_slug = 'mistral/leanstral-1-5';

update public.v2_request_facts
set requested_model_slug = case
      when requested_model_slug = 'mistral/leanstral' then 'mistral/leanstral:free'
      when requested_model_slug in ('mistral/leanstral-1.5', 'mistral/leanstral-1-5') then 'mistral/leanstral-1.5:free'
      else requested_model_slug
    end,
    routed_model_slug = case
      when routed_model_slug = 'mistral/leanstral' then 'mistral/leanstral:free'
      when routed_model_slug in ('mistral/leanstral-1.5', 'mistral/leanstral-1-5') then 'mistral/leanstral-1.5:free'
      else routed_model_slug
    end
where requested_model_slug in ('mistral/leanstral', 'mistral/leanstral-1.5', 'mistral/leanstral-1-5')
   or routed_model_slug in ('mistral/leanstral', 'mistral/leanstral-1.5', 'mistral/leanstral-1-5');

update public.v2_private_usage_daily
set model_slug = 'mistral/leanstral:free', updated_at = now()
where model_slug = 'mistral/leanstral';

update public.v2_public_usage_daily
set model_slug = 'mistral/leanstral:free', updated_at = now()
where model_slug = 'mistral/leanstral';

update public.v2_public_usage_hourly
set model_slug = 'mistral/leanstral:free', updated_at = now()
where model_slug = 'mistral/leanstral';

update public.v2_benchmark_results
set model_slug = 'mistral/leanstral:free'
where model_slug = 'mistral/leanstral';

update public.v2_model_links
set model_slug = 'mistral/leanstral-1.5:free'
where model_slug = 'mistral/leanstral-1.5';

update public.v2_model_details
set model_slug = 'mistral/leanstral-1.5:free'
where model_slug = 'mistral/leanstral-1.5';

delete from public.model_release_push_events
where model_slug = 'mistral/leanstral-1-5';

delete from public.v2_models
where model_slug in (
  'mistral/leanstral',
  'mistral/leanstral-1.5',
  'mistral/leanstral-1-5'
);

-- Convert every other authored free-only family. These models have no
-- standard provider route; their base rows were schema scaffolding only.

update public.v2_models free
set base_model_slug = null,
    metadata = (free.metadata - 'base_model_slug') || jsonb_build_object(
      'variant_kind', 'free',
      'standalone_free_model', true
    ),
    updated_at = now()
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where free.model_slug = mapping.free_slug;

update public.v2_models model
set previous_model_slug = mapping.free_slug,
    updated_at = now()
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where model.previous_model_slug = mapping.base_slug;

update public.v2_models model
set replacement_model_slug = mapping.free_slug,
    updated_at = now()
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where model.replacement_model_slug = mapping.base_slug;

update public.v2_request_facts fact
set requested_model_slug = mapping.free_slug
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where fact.requested_model_slug = mapping.base_slug;

update public.v2_request_facts fact
set routed_model_slug = mapping.free_slug
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where fact.routed_model_slug = mapping.base_slug;

update public.v2_private_usage_daily rollup
set model_slug = mapping.free_slug, updated_at = now()
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where rollup.model_slug = mapping.base_slug;

update public.v2_public_usage_daily rollup
set model_slug = mapping.free_slug, updated_at = now()
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where rollup.model_slug = mapping.base_slug;

update public.v2_public_usage_hourly rollup
set model_slug = mapping.free_slug, updated_at = now()
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where rollup.model_slug = mapping.base_slug;

update public.v2_benchmark_results result
set model_slug = mapping.free_slug
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where result.model_slug = mapping.base_slug;

update public.v2_model_links link
set model_slug = mapping.free_slug
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where link.model_slug = mapping.base_slug;

update public.v2_model_details detail
set model_slug = mapping.free_slug
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where detail.model_slug = mapping.base_slug;

update public.v2_model_aliases alias
set model_slug = mapping.free_slug,
    updated_at = now()
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where alias.model_slug = mapping.base_slug;

update public.v2_model_page_notices notice
set model_slug = mapping.free_slug,
    updated_at = now()
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where notice.model_slug = mapping.base_slug;

update public.v2_subscription_plan_models plan_model
set model_slug = mapping.free_slug
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where plan_model.model_slug = mapping.base_slug;

update public.model_release_push_events event
set model_slug = mapping.free_slug,
    updated_at = now()
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where event.model_slug = mapping.base_slug;

update public.v2_public_effective_pricing_daily pricing
set model_slug = mapping.free_slug,
    updated_at = now()
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where pricing.model_slug = mapping.base_slug;

update public.v2_public_provider_health_daily health
set model_slug = mapping.free_slug,
    updated_at = now()
from (values
  ('cohere/north-mini-code-1-0', 'cohere/north-mini-code-1-0:free'),
  ('google/gemma-3-1b', 'google/gemma-3-1b:free'),
  ('google/gemma-3n-e2b', 'google/gemma-3n-e2b:free'),
  ('xiaomi/mimo-v2-tts', 'xiaomi/mimo-v2-tts:free'),
  ('xiaomi/mimo-v2.5-tts', 'xiaomi/mimo-v2.5-tts:free')
) as mapping(base_slug, free_slug)
where health.model_slug = mapping.base_slug;

delete from public.v2_models
where model_slug in (
  'cohere/north-mini-code-1-0',
  'google/gemma-3-1b',
  'google/gemma-3n-e2b',
  'xiaomi/mimo-v2-tts',
  'xiaomi/mimo-v2.5-tts'
);

-- Speech 2.8's former standard routes are no longer authored. Its only
-- current catalogue offer is the free GMI route.
create temporary table standalone_free_speech_mapping (
  base_slug text primary key,
  free_slug text not null unique
) on commit drop;

insert into standalone_free_speech_mapping (base_slug, free_slug)
values ('minimax/speech-2.8', 'minimax/speech-2.8:free');

update public.v2_models free
set base_model_slug = null,
    metadata = (free.metadata - 'base_model_slug') || jsonb_build_object(
      'variant_kind', 'free',
      'standalone_free_model', true
    ),
    updated_at = now()
from standalone_free_speech_mapping mapping
where free.model_slug = mapping.free_slug;

update public.v2_models model
set previous_model_slug = mapping.free_slug, updated_at = now()
from standalone_free_speech_mapping mapping
where model.previous_model_slug = mapping.base_slug;

update public.v2_models model
set replacement_model_slug = mapping.free_slug, updated_at = now()
from standalone_free_speech_mapping mapping
where model.replacement_model_slug = mapping.base_slug;

-- Preserve existing provider route identities so their capabilities, pricing
-- SKUs, and historical provider_model_id references survive the model move.
update public.v2_model_provider_routes route
set model_slug = mapping.free_slug, updated_at = now()
from standalone_free_speech_mapping mapping
where route.model_slug = mapping.base_slug;

update public.v2_request_facts fact
set requested_model_slug = mapping.free_slug
from standalone_free_speech_mapping mapping
where fact.requested_model_slug = mapping.base_slug;

update public.v2_request_facts fact
set routed_model_slug = mapping.free_slug
from standalone_free_speech_mapping mapping
where fact.routed_model_slug = mapping.base_slug;

update public.v2_private_usage_daily rollup
set model_slug = mapping.free_slug, updated_at = now()
from standalone_free_speech_mapping mapping
where rollup.model_slug = mapping.base_slug;

update public.v2_public_usage_daily rollup
set model_slug = mapping.free_slug, updated_at = now()
from standalone_free_speech_mapping mapping
where rollup.model_slug = mapping.base_slug;

update public.v2_public_usage_hourly rollup
set model_slug = mapping.free_slug, updated_at = now()
from standalone_free_speech_mapping mapping
where rollup.model_slug = mapping.base_slug;

update public.v2_benchmark_results result
set model_slug = mapping.free_slug
from standalone_free_speech_mapping mapping
where result.model_slug = mapping.base_slug;

update public.v2_model_links link
set model_slug = mapping.free_slug
from standalone_free_speech_mapping mapping
where link.model_slug = mapping.base_slug;

update public.v2_model_details detail
set model_slug = mapping.free_slug
from standalone_free_speech_mapping mapping
where detail.model_slug = mapping.base_slug;

update public.v2_model_aliases alias
set model_slug = mapping.free_slug, updated_at = now()
from standalone_free_speech_mapping mapping
where alias.model_slug = mapping.base_slug;

update public.v2_model_page_notices notice
set model_slug = mapping.free_slug, updated_at = now()
from standalone_free_speech_mapping mapping
where notice.model_slug = mapping.base_slug;

update public.v2_subscription_plan_models plan_model
set model_slug = mapping.free_slug
from standalone_free_speech_mapping mapping
where plan_model.model_slug = mapping.base_slug;

-- A free-identity release event already exists for Speech 2.8 in production,
-- so the synthetic base event is removed rather than merged into its unique ID.
delete from public.model_release_push_events event
using standalone_free_speech_mapping mapping
where event.model_slug = mapping.base_slug;

insert into public.v2_public_effective_pricing_daily (
  model_slug, usage_date, provider_id, pricing_plan,
  input_tokens, output_tokens, cached_read_tokens, cached_write_tokens,
  input_cost_nanos, output_cost_nanos, total_cost_nanos, updated_at
)
select
  mapping.free_slug, pricing.usage_date, pricing.provider_id, pricing.pricing_plan,
  pricing.input_tokens, pricing.output_tokens, pricing.cached_read_tokens,
  pricing.cached_write_tokens, pricing.input_cost_nanos,
  pricing.output_cost_nanos, pricing.total_cost_nanos, now()
from public.v2_public_effective_pricing_daily pricing
join standalone_free_speech_mapping mapping
  on pricing.model_slug = mapping.base_slug
on conflict (model_slug, usage_date, provider_id, pricing_plan) do update set
  input_tokens = public.v2_public_effective_pricing_daily.input_tokens + excluded.input_tokens,
  output_tokens = public.v2_public_effective_pricing_daily.output_tokens + excluded.output_tokens,
  cached_read_tokens = public.v2_public_effective_pricing_daily.cached_read_tokens + excluded.cached_read_tokens,
  cached_write_tokens = public.v2_public_effective_pricing_daily.cached_write_tokens + excluded.cached_write_tokens,
  input_cost_nanos = public.v2_public_effective_pricing_daily.input_cost_nanos + excluded.input_cost_nanos,
  output_cost_nanos = public.v2_public_effective_pricing_daily.output_cost_nanos + excluded.output_cost_nanos,
  total_cost_nanos = public.v2_public_effective_pricing_daily.total_cost_nanos + excluded.total_cost_nanos,
  updated_at = now();

delete from public.v2_public_effective_pricing_daily pricing
using standalone_free_speech_mapping mapping
where pricing.model_slug = mapping.base_slug;

update public.v2_public_provider_health_daily health
set model_slug = mapping.free_slug, updated_at = now()
from standalone_free_speech_mapping mapping
where health.model_slug = mapping.base_slug;

delete from public.v2_models
where model_slug = 'minimax/speech-2.8';
