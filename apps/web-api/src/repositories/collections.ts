import { v2BenchmarkResults, v2Labs, v2ModelProviderRoutes, v2Models, v2RouteCapabilities } from "@phaseo/db/schema";
import { and, asc, eq, inArray } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function loadPublicCollectionData(env: Env, limit: number) {
	const { db, client } = createDatabase(env);
	try {
		const [modelRows, capabilities, routeRows, benchmarkRows] = await Promise.all([
			db.select({ model_slug: v2Models.modelSlug, name: v2Models.name, lab_slug: v2Models.labSlug, status: v2Models.status, released_at: v2Models.releasedAt, announced_at: v2Models.announcedAt, input_modalities: v2Models.inputModalities, output_modalities: v2Models.outputModalities, lab_name: v2Labs.name, lab_metadata: v2Labs.metadata })
				.from(v2Models).innerJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug)).where(eq(v2Models.hidden, false)).limit(20_000),
			db.select({ provider_model_id: v2RouteCapabilities.providerModelId, capability_id: v2RouteCapabilities.capabilityId, params: v2RouteCapabilities.params })
				.from(v2RouteCapabilities).where(eq(v2RouteCapabilities.status, "active")).orderBy(asc(v2RouteCapabilities.providerModelId), asc(v2RouteCapabilities.capabilityId)).limit(20_000),
			db.select({ provider_model_id: v2ModelProviderRoutes.providerModelId, model_slug: v2ModelProviderRoutes.modelSlug })
				.from(v2ModelProviderRoutes).where(and(eq(v2ModelProviderRoutes.routingEnabled, true), inArray(v2ModelProviderRoutes.status, ["active", "degraded"]))).orderBy(asc(v2ModelProviderRoutes.providerModelId)).limit(20_000),
			db.select({ benchmark_id: v2BenchmarkResults.benchmarkId, rank: v2BenchmarkResults.rank, model_slug: v2BenchmarkResults.modelSlug })
				.from(v2BenchmarkResults).where(inArray(v2BenchmarkResults.benchmarkId, ["aider-polyglot", "mmmu"])).orderBy(asc(v2BenchmarkResults.rank)).limit(limit * 8),
		]);
		return {
			models: modelRows.map((row) => ({ ...row, lab: { name: row.lab_name, metadata: row.lab_metadata } })),
			capabilities,
			routes: routeRows,
			benchmarkResults: benchmarkRows,
		};
	} finally { await client.end({ timeout: 1 }); }
}
