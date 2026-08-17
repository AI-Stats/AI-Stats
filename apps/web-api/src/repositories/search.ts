import { v2Benchmarks, v2Labs, v2Models, v2Providers } from "@phaseo/db/schema";
import { asc, desc, eq } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function loadSearchCatalogue(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		const [models, organisations, benchmarks, providers] = await Promise.all([
			db.select({ model_slug: v2Models.modelSlug, name: v2Models.name, lab_slug: v2Models.labSlug, released_at: v2Models.releasedAt, announced_at: v2Models.announcedAt, lab_name: v2Labs.name }).from(v2Models).leftJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug)).where(eq(v2Models.hidden, false)).orderBy(desc(v2Models.releasedAt)),
			db.select({ lab_slug: v2Labs.labSlug, name: v2Labs.name }).from(v2Labs).orderBy(asc(v2Labs.name)),
			db.select({ benchmark_id: v2Benchmarks.benchmarkId, name: v2Benchmarks.name, total_models: v2Benchmarks.totalModels }).from(v2Benchmarks).orderBy(asc(v2Benchmarks.name)),
			db.select({ provider_slug: v2Providers.providerSlug, name: v2Providers.name }).from(v2Providers).orderBy(asc(v2Providers.name)),
		]);
		return { models, organisations, benchmarks, providers };
	} finally { await client.end({ timeout: 1 }); }
}
