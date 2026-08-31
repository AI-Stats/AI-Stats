-- Remove the unverified Wan 3 placeholder from environments where the
-- historical seed migration has already been applied.
-- phaseo:allow-destructive-migration reason: Remove the unverified qwen/wan3 placeholder and its derived billing history after verified Wan 3.0 routes replaced it.

delete from public.model_release_push_events
where model_slug = 'qwen/wan3';

delete from public.v2_private_usage_daily
where model_slug = 'qwen/wan3';

delete from public.v2_public_usage_daily
where model_slug = 'qwen/wan3';

delete from public.v2_public_usage_hourly
where model_slug = 'qwen/wan3';

delete from public.v2_models
where model_slug = 'qwen/wan3';
