import { v2BenchmarkResults, v2Benchmarks, v2Labs, v2ModelProviderRoutes, v2Models, v2Providers, v2RpcGatewayModelUsageDaily, v2WebPublicUsageHourly } from "@phaseo/db/schema";
import { and, eq, inArray, sql } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function getLandingStats(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		const [[counts], [usage]] = await Promise.all([
			db.select({ models: sql<number>`count(*) filter (where ${v2Models.hidden} = false)::int`, organisations: sql<number>`(select count(*) from ${v2Labs})::int`, benchmarks: sql<number>`(select count(*) from ${v2Benchmarks})::int`, benchmark_results: sql<number>`(select count(*) from ${v2BenchmarkResults})::int`, api_providers: sql<number>`(select count(*) from ${v2Providers})::int` }).from(v2Models),
			db.select({ tokens: sql<string>`coalesce(sum(${v2RpcGatewayModelUsageDaily.totalTokens}), 0)` }).from(v2RpcGatewayModelUsageDaily).where(sql`${v2RpcGatewayModelUsageDaily.dayBucket} >= current_date - 30`),
		]);
		return { db: counts ?? { models: 0, organisations: 0, benchmarks: 0, benchmark_results: 0, api_providers: 0 }, monthlyTokenTotal: Number(usage?.tokens ?? 0) };
	} finally { await client.end({ timeout: 1 }); }
}

export async function getLandingGatewayData(env: Env, hours: number, topModelsLimit: number) {
	const { db, client } = createDatabase(env);
	try {
		const [rollup, supported, topModels] = await Promise.all([
			db.execute<Record<string, unknown>>(sql`select date_trunc('hour', ${v2WebPublicUsageHourly.bucket15M}) as bucket_hour, sum(${v2WebPublicUsageHourly.requests})::bigint as requests, sum(${v2WebPublicUsageHourly.successRequests})::bigint as success_requests, sum(${v2WebPublicUsageHourly.totalTokens})::numeric as total_tokens, sum(${v2WebPublicUsageHourly.latencySumMs})::numeric as latency_sum_ms, sum(${v2WebPublicUsageHourly.latencySamples})::bigint as latency_samples from ${v2WebPublicUsageHourly} where ${v2WebPublicUsageHourly.bucket15M} >= now() - (${hours} * interval '1 hour') group by 1 order by 1`),
			db.select({ model_slug: v2ModelProviderRoutes.modelSlug, provider_slug: v2ModelProviderRoutes.providerSlug, effective_from: v2ModelProviderRoutes.effectiveFrom, effective_to: v2ModelProviderRoutes.effectiveTo }).from(v2ModelProviderRoutes).where(and(eq(v2ModelProviderRoutes.routingEnabled, true), inArray(v2ModelProviderRoutes.status, ["active", "degraded"]))),
			db.execute<Record<string, unknown>>(sql`select usage.model_id, model.name as model_name, model.lab_slug as organisation_id, lab.name as organisation_name, sum(usage.total_tokens)::bigint as total_tokens from ${v2RpcGatewayModelUsageDaily} usage left join ${v2Models} model on model.model_slug = usage.model_id left join ${v2Labs} lab on lab.lab_slug = model.lab_slug where usage.day_bucket >= current_date - 7 group by usage.model_id, model.name, model.lab_slug, lab.name order by total_tokens desc limit ${Math.max(0, topModelsLimit)}`),
		]);
		return { rollup: [...rollup], supported, topModels: [...topModels] };
	} finally { await client.end({ timeout: 1 }); }
}

export async function getLandingModelStats(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		const [models, active] = await Promise.all([
			db.select({ modelId: v2Models.modelSlug, organisationId: v2Models.labSlug, announcedAt: v2Models.announcedAt, releasedAt: v2Models.releasedAt }).from(v2Models).where(eq(v2Models.hidden, false)),
			db.select({ modelId: v2ModelProviderRoutes.modelSlug }).from(v2ModelProviderRoutes).where(and(eq(v2ModelProviderRoutes.routingEnabled, true), inArray(v2ModelProviderRoutes.status, ["active", "degraded"]))),
		]);
		const now = Date.now(), cutoff = now - 90 * 86400000; const modelIds = new Set(models.map((row) => row.modelId));
		return { modelsCount: models.length, orgsCount: new Set(models.map((row) => row.organisationId)).size, apiCount: new Set(active.map((row) => row.modelId).filter((id) => modelIds.has(id))).size, recentCount: models.filter((row) => [row.announcedAt, row.releasedAt].some((value) => { const timestamp = Date.parse(value ?? ""); return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now; })).length };
	} finally { await client.end({ timeout: 1 }); }
}

export async function listLandingMainModels(env: Env, modelIds: string[]) {
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.select({ model_id: v2Models.modelSlug, name: v2Models.name, release_date: v2Models.releasedAt, lab: v2Labs }).from(v2Models).innerJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug)).where(and(inArray(v2Models.modelSlug, modelIds), eq(v2Models.hidden, false)));
		return rows.map((row) => ({ model_id: row.model_id, name: row.name, release_date: row.release_date, data_organisations: { organisation_id: row.lab.labSlug, name: row.lab.name, colour: row.lab.metadata && typeof row.lab.metadata === "object" && !Array.isArray(row.lab.metadata) ? (row.lab.metadata as Record<string, unknown>).colour ?? null : null } }));
	} finally { await client.end({ timeout: 1 }); }
}
