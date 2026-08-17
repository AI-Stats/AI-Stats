import { v2Labs, v2ModelProviderRoutes, v2Models, v2Providers } from "@phaseo/db/schema";
import { and, asc, eq, inArray } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function loadModelAvailabilitySources(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		const [routes, providers, models] = await Promise.all([
			db.select({ provider_model_id: v2ModelProviderRoutes.providerModelId, provider_slug: v2ModelProviderRoutes.providerSlug, model_slug: v2ModelProviderRoutes.modelSlug, metadata: v2ModelProviderRoutes.metadata, effective_from: v2ModelProviderRoutes.effectiveFrom, effective_to: v2ModelProviderRoutes.effectiveTo }).from(v2ModelProviderRoutes).where(and(eq(v2ModelProviderRoutes.routingEnabled, true), inArray(v2ModelProviderRoutes.status, ["active", "degraded"]))).orderBy(asc(v2ModelProviderRoutes.providerModelId)),
			db.select({ provider_slug: v2Providers.providerSlug, metadata: v2Providers.metadata }).from(v2Providers).orderBy(asc(v2Providers.providerSlug)),
			db.select({ model_slug: v2Models.modelSlug, name: v2Models.name, lab_slug: v2Models.labSlug, lab_name: v2Labs.name }).from(v2Models).leftJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug)).where(eq(v2Models.hidden, false)).orderBy(asc(v2Models.modelSlug)),
		]);
		return { routes, providers, models };
	} finally { await client.end({ timeout: 1 }); }
}
