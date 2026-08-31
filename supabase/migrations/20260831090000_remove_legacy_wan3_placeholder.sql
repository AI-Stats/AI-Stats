-- Remove the unverified Wan 3 placeholder from environments where the
-- historical seed migration has already been applied.

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
