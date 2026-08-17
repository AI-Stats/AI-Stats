import { keys, v2ModelProviderRoutes, v2Models, v2Providers, workspaces } from "@phaseo/db/schema";
import { and, asc, desc, eq, inArray, ne } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function loadObservabilityDestinationOptions(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [[workspace], keyRows, providers, routes] = await Promise.all([
			db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
			db.select({ id: keys.id, name: keys.name, prefix: keys.prefix }).from(keys).where(and(
				eq(keys.workspaceId, workspaceId), ne(keys.status, "deleted"), ne(keys.name, "__chat_route_managed_key__"),
			)).orderBy(desc(keys.createdAt)),
			db.select({ id: v2Providers.providerSlug, name: v2Providers.name }).from(v2Providers).orderBy(asc(v2Providers.name)),
			db.select({ providerId: v2ModelProviderRoutes.providerSlug, modelId: v2ModelProviderRoutes.modelSlug })
				.from(v2ModelProviderRoutes).where(and(
					eq(v2ModelProviderRoutes.routingEnabled, true),
					inArray(v2ModelProviderRoutes.status, ["active", "degraded"]),
				)),
		]);
		const modelIds = [...new Set(routes.map((route) => route.modelId))];
		const models = modelIds.length
			? await db.select({ id: v2Models.modelSlug, name: v2Models.name, organisationId: v2Models.labSlug })
				.from(v2Models).where(inArray(v2Models.modelSlug, modelIds))
			: [];
		return { workspaceName: workspace?.name ?? null, keys: keyRows, providers, routes, models };
	} finally { await client.end({ timeout: 1 }); }
}
