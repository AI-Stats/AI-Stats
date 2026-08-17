import { gatewayRequests, v2BenchmarkResults, v2Benchmarks, v2Labs, v2ModelDetails, v2ModelLinks, v2Models, v2PublicUsageHourly, v2SubscriptionPlanModels, v2SubscriptionPlans } from "@phaseo/db/schema";
import { and, asc, eq, inArray, sql } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function listCompareCatalogueModels(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		return await db.select({ model: v2Models, lab: v2Labs }).from(v2Models)
			.innerJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug))
			.where(eq(v2Models.hidden, false)).orderBy(asc(v2Models.name));
	} finally { await client.end({ timeout: 1 }); }
}

export async function getCompareUsageAnalytics(env: Env, modelIds: string[]) {
	const ids = [...new Set(modelIds.map((id) => id.trim()).filter(Boolean))];
	if (!ids.length) return [];
	const { db, client } = createDatabase(env);
	try {
		const result = await db.execute<Record<string, unknown>>(sql`
			with requested(model_id) as (select unnest(array[${sql.join(ids.map((id) => sql`${id}`), sql`, `)}]::text[])),
			hourly as (
				select usage.model_slug as model_id, date_trunc('hour', usage.bucket_start) as bucket,
					sum(usage.requests)::bigint as requests,
					case when sum(usage.latency_count) > 0 then sum(usage.latency_sum_ms)::numeric / sum(usage.latency_count) end as avg_latency_ms,
					case when sum(usage.throughput_count) > 0 then sum(usage.throughput_sum) / sum(usage.throughput_count) end as avg_throughput
				from ${v2PublicUsageHourly} usage join requested on requested.model_id = usage.model_slug
				where usage.bucket_start >= now() - interval '24 hours'
				group by usage.model_slug, date_trunc('hour', usage.bucket_start)
			), hourly_json as (
				select model_id, jsonb_agg(jsonb_build_object('bucket', bucket, 'requests', requests, 'avg_latency_ms', avg_latency_ms, 'avg_throughput', avg_throughput) order by bucket) as points,
					sum(requests)::bigint as total_requests,
					case when sum(requests) > 0 then sum(avg_latency_ms * requests) / sum(requests) end as avg_latency_ms,
					case when sum(requests) > 0 then sum(avg_throughput * requests) / sum(requests) end as avg_throughput
				from hourly group by model_id
			), realtime as (
				select coalesce(nullif(request.canonical_model_id, ''), request.model_id) as model_id,
					count(*)::bigint as requests,
					percentile_cont(0.5) within group (order by request.latency_ms) filter (where request.latency_ms > 0) as latency_p50,
					percentile_cont(0.5) within group (order by request.throughput) filter (where request.throughput > 0) as throughput_p50
				from ${gatewayRequests} request join requested on requested.model_id = coalesce(nullif(request.canonical_model_id, ''), request.model_id)
				where request.created_at >= now() - interval '30 minutes'
				group by coalesce(nullif(request.canonical_model_id, ''), request.model_id)
			)
			select requested.model_id,
				coalesce(realtime.requests, 0)::bigint as realtime_requests,
				realtime.latency_p50 as realtime_latency_p50,
				realtime.throughput_p50 as realtime_throughput_p50,
				jsonb_build_object('last_24h', jsonb_build_object('total_requests', coalesce(hourly_json.total_requests, 0), 'avg_latency_ms', hourly_json.avg_latency_ms, 'avg_throughput', hourly_json.avg_throughput), 'hourly_24h', coalesce(hourly_json.points, '[]'::jsonb)) as performance
			from requested left join hourly_json using (model_id) left join realtime using (model_id)
		`);
		return [...result];
	} finally { await client.end({ timeout: 1 }); }
}

export async function loadCompareSelection(env: Env, modelIds: string[]) {
	const { db, client } = createDatabase(env);
	try {
		const [models, links, details, benchmarks, modelPlans, plans] = await Promise.all([
			db.select({ model: v2Models, lab: v2Labs }).from(v2Models).innerJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug)).where(and(inArray(v2Models.modelSlug, modelIds), eq(v2Models.hidden, false))),
			db.select().from(v2ModelLinks).where(inArray(v2ModelLinks.modelSlug, modelIds)),
			db.select().from(v2ModelDetails).where(inArray(v2ModelDetails.modelSlug, modelIds)),
			db.select({ result: v2BenchmarkResults, benchmark: v2Benchmarks }).from(v2BenchmarkResults).innerJoin(v2Benchmarks, eq(v2Benchmarks.benchmarkId, v2BenchmarkResults.benchmarkId)).where(inArray(v2BenchmarkResults.modelSlug, modelIds)),
			db.select().from(v2SubscriptionPlanModels).where(inArray(v2SubscriptionPlanModels.modelSlug, modelIds)),
			db.select({ plan: v2SubscriptionPlans, lab: v2Labs }).from(v2SubscriptionPlanModels).innerJoin(v2SubscriptionPlans, eq(v2SubscriptionPlans.planUuid, v2SubscriptionPlanModels.planUuid)).leftJoin(v2Labs, eq(v2Labs.labSlug, v2SubscriptionPlans.labSlug)).where(inArray(v2SubscriptionPlanModels.modelSlug, modelIds)).orderBy(asc(v2SubscriptionPlans.planId), asc(v2SubscriptionPlans.frequency)),
		]);
		const byModel = <T extends { modelSlug: string }>(rows: T[]) => { const map = new Map<string, T[]>(); for (const row of rows) map.set(row.modelSlug, [...(map.get(row.modelSlug) ?? []), row]); return map; };
		const linksByModel = byModel(links); const detailsByModel = byModel(details);
		const benchmarksByModel = new Map<string, Array<Record<string, unknown>>>();
		for (const { result, benchmark } of benchmarks) benchmarksByModel.set(result.modelSlug, [...(benchmarksByModel.get(result.modelSlug) ?? []), { id: result.resultId, benchmark_id: result.benchmarkId, score: result.score, is_self_reported: result.isSelfReported, other_info: result.otherInfo, source_link: result.sourceLink, rank: result.rank, benchmark: { id: benchmark.benchmarkId, name: benchmark.name, category: benchmark.category, link: benchmark.link, ascending_order: benchmark.ascendingOrder, type: benchmark.benchmarkType } }]);
		const comparisonModels = models.map(({ model, lab }) => ({ model_id: model.modelSlug, name: model.name, organisation_id: model.labSlug, description: model.description, status: model.status, previous_model_id: model.previousModelSlug, announcement_date: model.announcedAt, release_date: model.releasedAt, deprecation_date: model.deprecatedAt, retirement_date: model.retiredAt, license: model.license, input_types: model.inputModalities, output_types: model.outputModalities, organisation: { organisation_id: lab.labSlug, name: lab.name, country_code: lab.countryCode }, model_links: (linksByModel.get(model.modelSlug) ?? []).map((row) => ({ model_id: row.modelSlug, url: row.url, platform: row.linkKind, kind: row.linkKind })), model_details: (detailsByModel.get(model.modelSlug) ?? []).map((row) => ({ model_id: row.modelSlug, detail_name: row.detailName, detail_value: row.detailValue })), benchmark_results: benchmarksByModel.get(model.modelSlug) ?? [] }));
		const planRows = plans.map(({ plan, lab }) => { const metadata = lab?.metadata && typeof lab.metadata === "object" && !Array.isArray(lab.metadata) ? lab.metadata as Record<string, unknown> : {}; return { plan_uuid: plan.planUuid, plan_id: plan.planId, name: plan.name, lab_slug: plan.labSlug, description: plan.description, frequency: plan.frequency, price: plan.price, currency: plan.currency, link: plan.link, organisation_id: plan.labSlug, organisation: lab ? { organisation_id: lab.labSlug, name: lab.name, colour: metadata.colour ?? null } : null }; });
		return { models: comparisonModels, modelPlans: modelPlans.map((row) => ({ model_id: row.modelSlug, model_slug: row.modelSlug, plan_uuid: row.planUuid, model_info: row.modelInfo, rate_limit: row.rateLimit, other_info: row.otherInfo })), plans: planRows };
	} finally { await client.end({ timeout: 1 }); }
}
