import { sql } from "@phaseo/db/query";
import { apiApps, gatewayRequests, v2ModelProviderRoutes, v2Models, v2PublicUsageDaily, v2PublicUsageDailyMeters, v2PublicUsageHourly } from "@phaseo/db/schema";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export type ModelUsageDailyRow = Record<string, unknown> & {
	day_bucket: string;
	model_id: string;
	provider_id: string;
	endpoint: string;
};

export async function listModelUsageDaily(
	env: Env,
	input: {
		modelSlug: string;
		providerIds?: string[];
		since?: string | null;
		until?: string | null;
	},
): Promise<ModelUsageDailyRow[]> {
	const { db, client } = createDatabase(env);
	const providerIds = [...new Set(input.providerIds ?? [])].sort();
	const providerFilter = providerIds.length
		? sql`and coalesce(route.provider_slug, usage.provider_model_id, '') in (${sql.join(providerIds.map((id) => sql`${id}`), sql`, `)})`
		: sql``;
	try {
		const result = await db.execute<ModelUsageDailyRow>(sql`
			with base as (
				select usage.usage_date as day_bucket,
					usage.model_slug as model_id,
					coalesce(route.provider_slug, usage.provider_model_id, '') as provider_id,
					usage.requests,
					usage.successful_requests as success_requests,
					usage.failed_requests,
					greatest(usage.requests - usage.successful_requests - usage.failed_requests, 0) as neutral_requests,
					usage.rate_limited_requests,
					case when usage.latency_count > 0 then usage.latency_sum_ms::numeric / usage.latency_count else null end as avg_latency_ms,
					case when usage.generation_count > 0 then usage.generation_sum_ms::numeric / usage.generation_count else null end as avg_generation_ms,
					case when usage.throughput_count > 0 then usage.throughput_sum / usage.throughput_count else null end as avg_throughput,
					usage.rollup_id
				from ${v2PublicUsageDaily} usage
				left join ${v2ModelProviderRoutes} route on route.provider_model_id = usage.provider_model_id
				where usage.model_slug = ${input.modelSlug.trim().toLowerCase()}
					and (${input.since ?? null}::date is null or usage.usage_date >= ${input.since ?? null}::date)
					and (${input.until ?? null}::date is null or usage.usage_date <= ${input.until ?? null}::date)
					${providerFilter}
			), meters as (
				select rollup_id,
					sum(quantity) filter (where meter_key = 'input_tokens') as input_tokens,
					sum(quantity) filter (where meter_key = 'output_tokens') as output_tokens,
					sum(quantity) filter (where meter_key = 'reasoning_tokens') as reasoning_tokens,
					sum(quantity) filter (where meter_key = 'cached_input_tokens') as cached_read_tokens,
					sum(quantity) filter (where meter_key = 'input_characters') as input_characters,
					sum(quantity) filter (where meter_key = 'output_characters') as output_characters,
					sum(quantity) filter (where meter_key = 'image_inputs') as image_inputs,
					sum(quantity) filter (where meter_key = 'image_outputs') as image_outputs,
					sum(quantity) filter (where meter_key = 'audio_inputs') as audio_inputs,
					sum(quantity) filter (where meter_key = 'audio_outputs') as audio_outputs,
					sum(quantity) filter (where meter_key = 'video_inputs') as video_inputs,
					sum(quantity) filter (where meter_key = 'video_outputs') as video_outputs
				from ${v2PublicUsageDailyMeters}
				where rollup_id in (select rollup_id from base)
				group by rollup_id
			)
			select b.day_bucket, b.model_id, b.provider_id, ''::text as endpoint,
				sum(b.requests)::bigint as requests,
				sum(b.success_requests)::bigint as success_requests,
				sum(b.failed_requests)::bigint as failed_requests,
				sum(b.neutral_requests)::bigint as neutral_requests,
				sum(b.rate_limited_requests)::bigint as rate_limited_requests,
				sum(coalesce(m.input_tokens, 0) + coalesce(m.output_tokens, 0) + coalesce(m.reasoning_tokens, 0)) as total_tokens,
				sum(coalesce(m.input_tokens, 0)) as input_tokens,
				sum(coalesce(m.output_tokens, 0)) as output_tokens,
				sum(coalesce(m.reasoning_tokens, 0)) as reasoning_tokens,
				sum(coalesce(m.cached_read_tokens, 0)) as cached_read_tokens,
				sum(coalesce(m.input_characters, 0)) as input_characters,
				sum(coalesce(m.output_characters, 0)) as output_characters,
				sum(coalesce(m.input_characters, 0) + coalesce(m.output_characters, 0)) as total_characters,
				sum(coalesce(m.image_inputs, 0)) as image_inputs,
				sum(coalesce(m.image_outputs, 0)) as image_outputs,
				sum(coalesce(m.audio_inputs, 0)) as audio_inputs,
				sum(coalesce(m.audio_outputs, 0)) as audio_outputs,
				sum(coalesce(m.video_inputs, 0)) as video_inputs,
				sum(coalesce(m.video_outputs, 0)) as video_outputs,
				0::numeric as total_cost_nanos,
				case when sum(b.requests) > 0 then sum(b.avg_latency_ms * b.requests) / sum(b.requests) else null end as avg_latency_ms,
				case when sum(b.requests) > 0 then sum(b.avg_generation_ms * b.requests) / sum(b.requests) else null end as avg_generation_ms,
				case when sum(b.requests) > 0 then sum(b.avg_throughput * b.requests) / sum(b.requests) else null end as avg_throughput
			from base b left join meters m on m.rollup_id = b.rollup_id
			group by b.day_bucket, b.model_id, b.provider_id
			order by b.day_bucket, b.provider_id
		`);
		return [...result];
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function listModelApps(env: Env, modelSlug: string, requestedLimit: number) {
	const { db, client } = createDatabase(env);
	const limit = Math.max(1, Math.min(100, Math.trunc(requestedLimit) || 24));
	try {
		const result = await db.execute<Record<string, unknown>>(sql`
			with selected_rollups as (
				select rollup_id, app_id, usage_date, requests, successful_requests
				from ${v2PublicUsageDaily}
				where model_slug = ${modelSlug.trim().toLowerCase()} and app_id is not null
			), meter_totals as (
				select meter.rollup_id, sum(meter.quantity) as total_tokens
				from ${v2PublicUsageDailyMeters} meter
				where meter.rollup_id in (select rollup_id from selected_rollups)
					and meter.meter_key in ('input_tokens', 'output_tokens', 'reasoning_tokens')
				group by meter.rollup_id
			), app_usage as (
				select rollup.app_id,
					sum(rollup.requests)::bigint as requests,
					sum(rollup.successful_requests)::bigint as success_requests,
					sum(coalesce(meter.total_tokens, 0))::numeric as total_tokens,
					max(rollup.usage_date)::timestamptz as last_seen
				from selected_rollups rollup
				left join meter_totals meter on meter.rollup_id = rollup.rollup_id
				group by rollup.app_id
			)
			select usage.app_id, app.title, app.image_url, app.url, usage.last_seen,
				usage.requests, usage.success_requests, usage.total_tokens
			from app_usage usage
			join ${apiApps} app on app.id = usage.app_id
			where app.is_public = true
			order by usage.total_tokens desc, usage.requests desc, usage.app_id
			limit ${limit}
		`);
		return [...result];
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function getModelRealtimeStats(
	env: Env,
	modelIds: string[],
	since: string,
	until: string,
) {
	const ids = [...new Set(modelIds.map((id) => id.trim()).filter(Boolean))];
	if (!ids.length) return { requestsInWindow: 0, latencyP50Ms: null, throughputP50TokPerSec: null };
	const { db, client } = createDatabase(env);
	try {
		const [row] = await db.execute<Record<string, unknown>>(sql`
			with samples as (
				select latency_ms,
					case
						when throughput > 0 then throughput
						when generation_ms > 0 and usage_output_tokens is not null then usage_output_tokens::numeric * 1000 / generation_ms
						else null
					end as effective_throughput
				from ${gatewayRequests}
				where model_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
					and created_at >= ${since}::timestamptz
					and created_at <= ${until}::timestamptz
			)
			select count(*)::int as requests_in_window,
				percentile_cont(0.5) within group (order by latency_ms) filter (where latency_ms > 0) as latency_p50_ms,
				percentile_cont(0.5) within group (order by effective_throughput) filter (where effective_throughput > 0) as throughput_p50
			from samples
		`);
		return {
			requestsInWindow: Number(row?.requests_in_window ?? 0),
			latencyP50Ms: row?.latency_p50_ms == null ? null : Number(row.latency_p50_ms),
			throughputP50TokPerSec: row?.throughput_p50 == null ? null : Number(row.throughput_p50),
		};
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function getModelTokenTrajectory(env: Env, modelSlug: string) {
	const { db, client } = createDatabase(env);
	const slug = modelSlug.trim().toLowerCase();
	try {
		const [row] = await db.execute<Record<string, unknown>>(sql`
			with model_row as (
				select model_slug, released_at as release_date, deprecated_at as deprecation_date
				from ${v2Models}
				where model_slug = ${slug} and hidden = false and status <> 'disabled'
				limit 1
			), model_ids as (
				select model_slug as model_id from model_row
				union select route.provider_model_id from ${v2ModelProviderRoutes} route where route.model_slug = ${slug}
				union select route.provider_model_slug from ${v2ModelProviderRoutes} route where route.model_slug = ${slug}
			), anchors as (
				select release_date, deprecation_date,
					date_trunc('day', now() at time zone 'utc') as today,
					date_trunc('day', release_date) as start_day
				from model_row where release_date is not null
			), daily_tokens as (
				select date_trunc('day', request.created_at at time zone 'utc') as day,
					sum(coalesce(nullif(request.usage_total_tokens, 0), coalesce(request.usage_input_tokens, 0) + coalesce(request.usage_output_tokens, 0))) as tokens
				from ${gatewayRequests} request cross join model_row
				where request.model_id in (select model_id from model_ids)
					and model_row.release_date is not null and request.created_at >= model_row.release_date
				group by 1
			), point_series as (
				select series.day, coalesce(tokens.tokens, 0) as tokens,
					sum(coalesce(tokens.tokens, 0)) over (order by series.day) as cumulative_tokens,
					floor(extract(epoch from (series.day - (select release_date from model_row))) / 86400)::int as days_since_release
				from (select generate_series((select start_day from anchors), (select today from anchors), interval '1 day') as day) series
				left join daily_tokens tokens on tokens.day = series.day
			), points_json as (
				select coalesce(jsonb_agg(jsonb_build_object(
					'date', to_char(day, 'YYYY-MM-DD"T"00:00:00.000Z'),
					'tokens', tokens, 'cumulativeTokens', cumulative_tokens,
					'daysSinceRelease', days_since_release
				) order by day), '[]'::jsonb) as value from point_series
			), milestones as (
				select coalesce(jsonb_agg(jsonb_build_object(
					'threshold', threshold,
					'reachedOn', (select to_char(day, 'YYYY-MM-DD"T"00:00:00.000Z') from point_series where cumulative_tokens >= threshold order by day limit 1),
					'daysSinceRelease', (select days_since_release from point_series where cumulative_tokens >= threshold order by day limit 1)
				) order by threshold), '[]'::jsonb) as value
				from unnest(array[1000000, 10000000, 100000000, 1000000000]) threshold
			), successors as (
				select coalesce(jsonb_agg(jsonb_build_object(
					'modelId', successor.model_slug, 'name', successor.name,
					'releaseDate', successor.released_at,
					'daysSinceRelease', case when model_row.release_date is null or successor.released_at is null then null else floor(extract(epoch from (successor.released_at - model_row.release_date)) / 86400)::int end
				) order by successor.released_at nulls last, successor.model_slug), '[]'::jsonb) as value
				from ${v2Models} successor cross join model_row
				where successor.previous_model_slug = ${slug} and successor.hidden = false and successor.status <> 'disabled'
			)
			select model_row.release_date, model_row.deprecation_date,
				points_json.value as points, milestones.value as token_milestones,
				successors.value as successor_milestones
			from model_row cross join points_json cross join milestones cross join successors
			where model_row.release_date is not null
		`);
		return row ?? null;
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function listModelPerformanceColos(env: Env, modelSlug: string) {
	const { db, client } = createDatabase(env);
	try {
		const result = await db.execute<Record<string, unknown>>(sql`
			select upper(trim(cloudflare_colo)) as cloudflare_colo,
				sum(requests)::bigint as request_count
			from ${v2PublicUsageHourly}
			where model_slug = ${modelSlug.trim().toLowerCase()}
				and cloudflare_colo is not null
				and bucket_start >= now() - interval '30 days'
			group by upper(trim(cloudflare_colo))
			order by request_count desc, cloudflare_colo asc
		`);
		return [...result];
	} finally {
		await client.end({ timeout: 1 });
	}
}
