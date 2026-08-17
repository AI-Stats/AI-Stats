import { sql } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export type RankingRow = Record<string, unknown>;

async function rows(env: Env, query: ReturnType<typeof sql>): Promise<RankingRow[]> {
	const { db, client } = createDatabase(env);
	try {
		return [...await db.execute<RankingRow>(query)];
	} finally {
		await client.end({ timeout: 1 });
	}
}

function rangeDays(value: string) {
	return value === "24h" ? 1 : value === "today" ? 0 : value === "month" ? 30 : value === "year" ? 365 : 7;
}

function bucketExpression(bucketSize: string, column: string) {
	const unit = bucketSize === "month" ? "month" : bucketSize === "week" ? "week" : bucketSize === "day" ? "day" : "hour";
	return sql.raw(`date_trunc('${unit}', ${column})`);
}

export function listModelPerformance(env: Env, hours: number) {
	return rows(env, sql`
		select usage.model_slug model_id, coalesce(route.provider_slug, 'unknown') provider,
			sum(usage.requests)::bigint requests, 0::numeric cost_per_1m_tokens,
			round(sum(usage.latency_sum_ms)::numeric / nullif(sum(usage.latency_count), 0), 0) median_latency_ms,
			null::numeric p95_latency_ms,
			round(sum(usage.throughput_sum)::numeric / nullif(sum(usage.throughput_count), 0), 2) median_throughput,
			round(sum(usage.successful_requests)::numeric / nullif(sum(usage.requests), 0), 4) success_rate
		from observability.v2_public_usage_hourly usage
		left join catalog.v2_model_provider_routes route on route.provider_model_id = usage.provider_model_id
		where usage.bucket_start >= now() - (${hours} * interval '1 hour')
			and lower(usage.model_slug) not in ('unknown', 'other')
		group by usage.model_slug, coalesce(route.provider_slug, 'unknown')
		order by requests desc
	`);
}

export async function listFastestModels(env: Env, days: number, limit: number) {
	const result = await rows(env, sql`
		select usage.model_slug model_id, coalesce(route.provider_slug, 'unknown') provider,
			sum(usage.requests)::bigint requests, 0::numeric cost_per_1m_tokens,
			round(sum(usage.latency_sum_ms)::numeric / nullif(sum(usage.latency_count), 0), 0) median_latency_ms,
			null::numeric p95_latency_ms,
			round(sum(usage.throughput_sum)::numeric / nullif(sum(usage.throughput_count), 0), 2) median_throughput,
			round(sum(usage.successful_requests)::numeric / nullif(sum(usage.requests), 0), 4) success_rate
		from observability.v2_public_usage_daily usage
		left join catalog.v2_model_provider_routes route on route.provider_model_id = usage.provider_model_id
		where usage.usage_date >= current_date - ${days}
			and lower(usage.model_slug) not in ('unknown', 'other')
		group by usage.model_slug, coalesce(route.provider_slug, 'unknown')
		having sum(usage.throughput_count) > 0 or sum(usage.latency_count) > 0
		order by requests desc limit ${limit}
	`);
	return result;
}

export function listUsageTimeseries(env: Env, timeRange: string, bucketSize: string, topN: number) {
	const days = rangeDays(timeRange);
	const bucket = bucketExpression(bucketSize, "usage.bucket_start");
	return rows(env, sql`
		with meter as (
			select rollup_id, sum(quantity) filter (where meter_key in ('input_tokens','output_tokens')) tokens
			from observability.v2_public_usage_hourly_meters group by rollup_id
		), base as (
			select ${bucket} bucket, usage.model_slug model_id, sum(usage.requests)::bigint requests,
				sum(coalesce(meter.tokens, 0))::numeric tokens
			from observability.v2_public_usage_hourly usage left join meter using (rollup_id)
			where usage.bucket_start >= now() - (${days} * interval '1 day')
				and lower(usage.model_slug) not in ('unknown','other')
			group by 1, 2
		), ranked as (
			select *, dense_rank() over (partition by bucket order by tokens desc, requests desc, model_id) bucket_rank from base
		)
		select ranked.bucket, ranked.model_id, ranked.requests, ranked.tokens,
			coalesce(nullif(lab.metadata->>'colour',''), nullif(model.metadata->>'colour','')) colour
		from ranked left join catalog.v2_models model on model.model_slug=ranked.model_id
		left join catalog.v2_labs lab on lab.lab_slug=model.lab_slug
		where bucket_rank <= ${topN} order by bucket, tokens desc
	`);
}

export function listModalityTimeseries(env: Env, metric: string, timeRange: string, topN: number) {
	const days = rangeDays(timeRange);
	const meterPredicate = metric === "image_inputs"
		? sql`meter.modality = 'image' and meter.meter_key like 'input%'
		`
		: metric === "text_tokens"
			? sql`meter.modality = 'text' and meter.meter_key in ('input_tokens','output_tokens','input_text_tokens','output_text_tokens')`
			: sql`meter.meter_key = ${metric}`;
	return rows(env, sql`
		with base as (
			select date_trunc('week', usage.usage_date::timestamp) bucket, usage.model_slug model_id,
				sum(usage.requests)::bigint requests, sum(meter.quantity)::numeric tokens
			from observability.v2_public_usage_daily usage join observability.v2_public_usage_daily_meters meter using (rollup_id)
			where usage.usage_date >= current_date - ${days} and ${meterPredicate}
				and lower(usage.model_slug) not in ('unknown','other')
			group by 1,2
		), ranked as (
			select *, dense_rank() over (partition by bucket order by tokens desc, requests desc, model_id) bucket_rank from base
		)
		select ranked.bucket, ranked.model_id, ranked.requests, ranked.tokens,
			coalesce(nullif(lab.metadata->>'colour',''), nullif(model.metadata->>'colour','')) colour
		from ranked left join catalog.v2_models model on model.model_slug=ranked.model_id
		left join catalog.v2_labs lab on lab.lab_slug=model.lab_slug
		where bucket_rank <= ${topN} order by bucket, tokens desc
	`);
}

export function listUniqueUsers(env: Env, timeRange: string, bucketSize: string, topN: number) {
	const days = rangeDays(timeRange);
	const bucket = bucketExpression(bucketSize, "usage.day_bucket::timestamp");
	return rows(env, sql`
		with base as (
			select ${bucket} bucket, usage.model_id, sum(usage.requests)::bigint requests,
				sum(usage.tokens)::bigint tokens, count(distinct usage.actor_hash)::bigint users
			from observability.public_model_user_usage_daily usage
			where usage.day_bucket >= current_date - ${days} and lower(usage.model_id) not in ('unknown','other')
			group by 1,2
		), ranked as (
			select *, dense_rank() over (partition by bucket order by users desc, tokens desc, requests desc, model_id) bucket_rank from base
		)
		select ranked.bucket, ranked.model_id, ranked.requests, ranked.tokens, ranked.users,
			coalesce(nullif(lab.metadata->>'colour',''), nullif(model.metadata->>'colour','')) colour
		from ranked left join catalog.v2_models model on model.model_slug=ranked.model_id
		left join catalog.v2_labs lab on lab.lab_slug=model.lab_slug
		where bucket_rank <= ${topN} order by bucket, users desc
	`);
}

export function listToolCalls(env: Env, timeRange: string, bucketSize: string, topN: number) {
	const days = rangeDays(timeRange);
	const bucket = bucketExpression(bucketSize, "usage.usage_date::timestamp");
	return rows(env, sql`
		with base as (
			select ${bucket} bucket, usage.model_slug model_id, sum(usage.requests)::bigint requests,
				sum(usage.tool_call_count)::bigint tool_calls, sum(usage.tool_call_requests)::bigint tool_call_requests,
				sum(usage.tool_call_successes)::bigint tool_call_successes
			from observability.v2_public_usage_daily usage
			where usage.usage_date >= current_date - ${days} and lower(usage.model_slug) not in ('unknown','other')
			group by 1,2
		), ranked as (
			select *, dense_rank() over (partition by bucket order by tool_calls desc, requests desc, model_id) bucket_rank from base
		)
		select ranked.*, coalesce(nullif(lab.metadata->>'colour',''), nullif(model.metadata->>'colour','')) colour
		from ranked left join catalog.v2_models model on model.model_slug=ranked.model_id
		left join catalog.v2_labs lab on lab.lab_slug=model.lab_slug
		where bucket_rank <= ${topN} order by bucket, tool_calls desc
	`);
}

export function listIntelligenceIndex(env: Env, limit: number) {
	return rows(env, sql`
		with scored as (
			select benchmark.benchmark_id, benchmark.name benchmark_name, benchmark.benchmark_type, benchmark.category,
				model.model_slug model_id, model.name model_name, model.lab_slug organisation_id, lab.name organisation_name,
				result.score_numeric score, row_number() over(order by result.score_numeric desc, model.name, model.model_slug) rank,
				count(*) over() total_models
			from catalog.v2_benchmark_results result join catalog.v2_benchmarks benchmark using (benchmark_id)
			join catalog.v2_models model using (model_slug) left join catalog.v2_labs lab on lab.lab_slug=model.lab_slug
			where result.benchmark_id='aa-intelligence-index-v4' and result.score_numeric is not null and model.hidden=false
		)
		select * from scored where rank <= ${limit} order by rank
	`);
}

export function listModelRankings(env: Env, timeRange: string, metric: string, limit: number) {
	const days = rangeDays(timeRange);
	const score = metric === "requests" ? sql`requests` : metric === "cost" ? sql`total_cost_usd` : sql`total_tokens`;
	return rows(env, sql`
		with meters as (
			select rollup_id, sum(quantity) filter(where meter_key in ('input_tokens','output_tokens')) total_tokens,
				sum(quantity) filter(where meter_key='input_tokens') input_tokens,
				sum(quantity) filter(where meter_key='output_tokens') output_tokens
			from observability.v2_public_usage_daily_meters group by rollup_id
		), base as (
			select usage.model_slug model_id, coalesce(route.provider_slug,'unknown') provider,
				sum(usage.requests)::bigint requests, sum(coalesce(meters.total_tokens,0))::bigint total_tokens,
				sum(coalesce(meters.input_tokens,0))::bigint input_tokens, sum(coalesce(meters.output_tokens,0))::bigint output_tokens,
				sum(usage.cost_nanos)::numeric/1000000000 total_cost_usd,
				round(sum(usage.latency_sum_ms)::numeric/nullif(sum(usage.latency_count),0),0) median_latency_ms,
				round(sum(usage.throughput_sum)::numeric/nullif(sum(usage.throughput_count),0),2) median_throughput,
				round(sum(usage.successful_requests)::numeric/nullif(sum(usage.requests),0),4) success_rate
			from observability.v2_public_usage_daily usage left join meters using(rollup_id)
			left join catalog.v2_model_provider_routes route on route.provider_model_id=usage.provider_model_id
			where usage.usage_date >= current_date-${days} and lower(usage.model_slug) not in ('unknown','other')
			group by usage.model_slug,coalesce(route.provider_slug,'unknown')
		), ranked as (select *,row_number() over(order by ${score} desc,model_id,provider)::integer rank from base where requests>0)
		select *,null::integer prev_rank,'same'::text trend from ranked order by rank limit ${limit}
	`);
}

export function listTrendingModels(env: Env, limit: number) {
	return rows(env, sql`
		with weekly as (
			select usage.model_slug model_id,coalesce(route.provider_slug,'unknown') provider,
				sum(usage.requests) filter(where usage.usage_date>=current_date-7)::bigint current_week_requests,
				sum(usage.requests) filter(where usage.usage_date>=current_date-14 and usage.usage_date<current_date-7)::bigint previous_week_requests,
				sum(usage.requests) filter(where usage.usage_date>=current_date-21 and usage.usage_date<current_date-14)::bigint two_weeks_ago_requests
			from observability.v2_public_usage_daily usage left join catalog.v2_model_provider_routes route on route.provider_model_id=usage.provider_model_id
			where usage.usage_date>=current_date-21 and lower(usage.model_slug) not in ('unknown','other') group by 1,2
		)
		select *,((current_week_requests-previous_week_requests)-(previous_week_requests-two_weeks_ago_requests))::numeric velocity,
			(((current_week_requests-previous_week_requests)-(previous_week_requests-two_weeks_ago_requests))*2.0+(current_week_requests-previous_week_requests))::numeric momentum_score
		from weekly where current_week_requests>previous_week_requests order by momentum_score desc limit ${limit}
	`);
}

export function getRankingSummary(env: Env) {
	return rows(env, sql`
		with meters as (select rollup_id,sum(quantity) filter(where meter_key in ('input_tokens','output_tokens')) tokens from observability.v2_public_usage_hourly_meters group by rollup_id)
		select coalesce(sum(usage.requests),0)::bigint total_requests_24h,coalesce(sum(meters.tokens),0)::bigint total_tokens_24h,
			count(distinct usage.model_slug)::integer total_models,count(distinct route.provider_slug)::integer total_providers,
			round(sum(usage.latency_sum_ms)::numeric/nullif(sum(usage.latency_count),0),0) avg_latency_ms,
			round(sum(usage.successful_requests)::numeric/nullif(sum(usage.requests),0),4) success_rate_24h
		from observability.v2_public_usage_hourly usage left join meters using(rollup_id)
		left join catalog.v2_model_provider_routes route on route.provider_model_id=usage.provider_model_id
		where usage.bucket_start>=now()-interval '24 hours'
	`);
}

export function listMarketShare(env: Env, dimension: "provider" | "organization", timeRange: string) {
	const days = rangeDays(timeRange);
	const key = dimension === "provider" ? sql`coalesce(route.provider_slug,'unknown')` : sql`coalesce(model.lab_slug,'unknown')`;
	const name = dimension === "provider" ? sql`coalesce(provider.name,route.provider_slug,'Unknown')` : sql`coalesce(lab.name,model.lab_slug,'Unknown')`;
	const colour = dimension === "provider" ? sql`provider.metadata->>'colour'` : sql`lab.metadata->>'colour'`;
	return rows(env, sql`
		with meters as (select rollup_id,sum(quantity) filter(where meter_key in ('input_tokens','output_tokens')) tokens from observability.v2_public_usage_daily_meters group by rollup_id),
		base as (
			select ${key} id, max(${name}) name, max(${colour}) colour, sum(usage.requests)::bigint requests, sum(coalesce(meters.tokens,0))::numeric tokens
			from observability.v2_public_usage_daily usage left join meters using(rollup_id)
			left join catalog.v2_model_provider_routes route on route.provider_model_id=usage.provider_model_id
			left join catalog.v2_providers provider on provider.provider_slug=route.provider_slug
			left join catalog.v2_models model on model.model_slug=usage.model_slug left join catalog.v2_labs lab on lab.lab_slug=model.lab_slug
			where usage.usage_date>=current_date-${days} and lower(usage.model_slug) not in ('unknown','other') group by ${key}
		)
		select *,round(tokens/nullif(sum(tokens) over(),0)*100,2) share_percent from base where id<>'unknown' order by tokens desc
	`);
}

export function listMarketShareTimeseries(env: Env, dimension: "provider" | "organization", timeRange: string, bucketSize: string, topN: number) {
	const days = rangeDays(timeRange);
	const bucket = bucketExpression(bucketSize, "usage.usage_date::timestamp");
	const key = dimension === "provider" ? sql`coalesce(route.provider_slug,'unknown')` : sql`coalesce(model.lab_slug,'unknown')`;
	return rows(env, sql`
		with meters as (select rollup_id,sum(quantity) filter(where meter_key in ('input_tokens','output_tokens')) tokens from observability.v2_public_usage_daily_meters group by rollup_id),
		base as (
			select ${bucket} bucket,${key} id,sum(usage.requests)::bigint requests,sum(coalesce(meters.tokens,0))::numeric tokens
			from observability.v2_public_usage_daily usage left join meters using(rollup_id)
			left join catalog.v2_model_provider_routes route on route.provider_model_id=usage.provider_model_id
			left join catalog.v2_models model on model.model_slug=usage.model_slug
			where usage.usage_date>=current_date-${days} and lower(usage.model_slug) not in ('unknown','other') group by 1,2
		),ranked as(select *,dense_rank() over(partition by bucket order by tokens desc,requests desc,id) bucket_rank from base)
		select ranked.bucket,ranked.id,ranked.requests,ranked.tokens,round(ranked.tokens/nullif(sum(ranked.tokens) over(partition by ranked.bucket),0)*100,2) share_percent
		from ranked where id<>'unknown' and bucket_rank<=${topN} order by bucket,tokens desc
	`);
}

export function listMultimodalBreakdown(env: Env, timeRange: string) {
	const days = rangeDays(timeRange);
	return rows(env, sql`
		select meter.modality, meter.meter_key, meter.unit, sum(meter.quantity)::numeric tokens,
			sum(usage.requests)::bigint requests, round(sum(meter.quantity)/nullif(sum(sum(meter.quantity)) over(),0)*100,2) share_percent
		from observability.v2_public_usage_daily usage join observability.v2_public_usage_daily_meters meter using(rollup_id)
		where usage.usage_date>=current_date-${days} and lower(usage.model_slug) not in ('unknown','other')
		group by meter.modality,meter.meter_key,meter.unit order by tokens desc
	`);
}

export function listGeography(env: Env, from: Date, to: Date) {
	return rows(env, sql`
		with facts as materialized(select request_event_id,workspace_id,edge_country from observability.v2_request_facts where occurred_at>=${from.toISOString()} and occurred_at<${to.toISOString()} and edge_country is not null),
		tokens as(select fact.request_event_id,coalesce(nullif(sum(usage.quantity) filter(where usage.meter_key in ('input_tokens','output_tokens')),0),sum(usage.quantity) filter(where usage.meter_key in ('input_text_tokens','output_text_tokens','input_image_tokens','output_image_tokens','input_audio_tokens','output_audio_tokens','input_video_tokens','output_video_tokens')),0) tokens from facts fact left join observability.v2_request_usage usage using(request_event_id) group by fact.request_event_id),
		countries as(select fact.edge_country country_code,count(*)::bigint requests,coalesce(sum(tokens.tokens),0) tokens,count(distinct fact.workspace_id)::bigint workspace_count from facts fact left join tokens using(request_event_id) group by fact.edge_country)
		select *,round(requests::numeric/nullif(sum(requests) over(),0)*100,2) share_percent from countries where requests>=1 and workspace_count>=1 order by requests desc,country_code
	`);
}

export function listContextLengths(env: Env, days: number) {
	return rows(env, sql`
		with scoped as materialized(select request_event_id,workspace_id from observability.v2_request_facts where occurred_at>=now()-(${days}*interval '1 day')),
		per_request as(select scoped.request_event_id,scoped.workspace_id,coalesce(sum(usage.quantity) filter(where usage.meter_key in ('input_tokens','input_text_tokens','prompt_tokens')),0)::bigint input_tokens from scoped left join observability.v2_request_usage usage using(request_event_id) group by 1,2),
		bucketed as(select workspace_id,case when input_tokens<4096 then 'under_4k' when input_tokens<16384 then '4k_16k' when input_tokens<32768 then '16k_32k' when input_tokens<65536 then '32k_64k' when input_tokens<131072 then '64k_128k' else '128k_plus' end bucket_key from per_request where input_tokens>0),
		buckets(bucket_key,bucket_label,bucket_order,min_tokens,max_tokens) as(values ('under_4k','Under 4K',1,0::bigint,4095::bigint),('4k_16k','4K–16K',2,4096::bigint,16383::bigint),('16k_32k','16K–32K',3,16384::bigint,32767::bigint),('32k_64k','32K–64K',4,32768::bigint,65535::bigint),('64k_128k','64K–128K',5,65536::bigint,131071::bigint),('128k_plus','128K+',6,131072::bigint,null::bigint)),
		counts as(select bucket_key,count(*)::bigint requests,count(distinct workspace_id)::bigint workspace_count from bucketed group by bucket_key),total as(select count(*)::bigint requests from bucketed)
		select buckets.*,coalesce(counts.requests,0)::bigint requests,case when total.requests>0 then round(coalesce(counts.requests,0)::numeric/total.requests*100,2) else 0 end share_percent,coalesce(counts.workspace_count,0)::bigint workspace_count
		from buckets cross join total left join counts using(bucket_key) order by bucket_order
	`);
}

export async function loadRankingBenchmarks(env: Env, benchmarkIds: readonly string[]) {
	const { db, client } = createDatabase(env);
	try {
		const ids = sql.join(benchmarkIds.map((id) => sql`${id}`), sql`, `);
		const [benchmarks, scores] = await Promise.all([
			db.execute<RankingRow>(sql`select benchmark_id,name,category,ascending_order,benchmark_type,total_models from catalog.v2_benchmarks where benchmark_id in (${ids})`),
			db.execute<RankingRow>(sql`select benchmark_id,model_slug,score_numeric,rank from catalog.v2_benchmark_results where benchmark_id in (${ids}) and score_numeric is not null limit 2000`),
		]);
		const modelIds = [...new Set([...scores].map((row) => String(row.model_slug ?? "")).filter(Boolean))];
		const models = modelIds.length
			? await db.execute<RankingRow>(sql`select model.model_slug,model.name,model.lab_slug,lab.name lab_name from catalog.v2_models model left join catalog.v2_labs lab on lab.lab_slug=model.lab_slug where model.model_slug in (${sql.join(modelIds.map((id) => sql`${id}`), sql`, `)}) and model.hidden=false`)
			: [];
		return { benchmarks: [...benchmarks], scores: [...scores], models: [...models] };
	} finally { await client.end({ timeout: 1 }); }
}

export function listProviderMetadata(env: Env, ids: string[]) {
	return rows(env, sql`select provider_slug,name,metadata->>'colour' colour from catalog.v2_providers where provider_slug in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
}

export function listOrganisationLogoIds(env: Env, names: string[]) {
	return rows(env, sql`select lab_slug,name from catalog.v2_labs where lab_slug in (${sql.join(names.map((id) => sql`${id}`), sql`, `)}) or name in (${sql.join(names.map((id) => sql`${id}`), sql`, `)})`);
}

export function listModelMetadata(env: Env, ids: string[]) {
	const values = sql.join(ids.map((id) => sql`(${id}::text)`), sql`, `);
	return rows(env, sql`
		with requested(requested_id) as (values ${values}), resolved as (
			select requested.requested_id,coalesce(direct.model_slug,route_id.model_slug,route_slug.model_slug,alias.model_slug) model_slug
			from requested left join catalog.v2_models direct on direct.model_slug=requested.requested_id and direct.hidden=false
			left join lateral(select model_slug from catalog.v2_model_provider_routes where provider_model_id=requested.requested_id limit 1) route_id on direct.model_slug is null
			left join lateral(select model_slug from catalog.v2_model_provider_routes where provider_model_slug=requested.requested_id limit 1) route_slug on direct.model_slug is null and route_id.model_slug is null
			left join catalog.v2_model_aliases alias on alias.alias_slug=requested.requested_id and alias.enabled=true
		)
		select resolved.requested_id,model.model_slug model_id,model.name,model.lab_slug organisation_id,lab.name organisation_name,
			lab.metadata->>'colour' organisation_colour,model.license
		from resolved left join catalog.v2_models model on model.model_slug=resolved.model_slug and model.hidden=false
		left join catalog.v2_labs lab on lab.lab_slug=model.lab_slug
	`);
}
