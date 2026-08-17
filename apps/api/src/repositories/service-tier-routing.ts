import { v2ModelProviderRoutes, v2RouteCapabilities } from "@phaseo/db/schema";
import { and, eq, inArray, or } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function loadTierSiblingRows(args: { providerId: string; modelId: string; capability: string; routingEnabled: boolean; capabilityStatuses: string[] }) {
	return withDatabase(async (db) => {
		const routeConditions = [
			eq(v2ModelProviderRoutes.providerSlug, args.providerId),
			or(eq(v2ModelProviderRoutes.modelSlug, args.modelId), eq(v2ModelProviderRoutes.providerModelSlug, args.modelId))!,
			eq(v2ModelProviderRoutes.routingEnabled, args.routingEnabled),
		];
		if (args.routingEnabled) routeConditions.push(inArray(v2ModelProviderRoutes.status, ["active", "degraded"]));
		const routes = await db.select({
			provider_model_id: v2ModelProviderRoutes.providerModelId,
			provider_model_slug: v2ModelProviderRoutes.providerModelSlug,
			routing_enabled: v2ModelProviderRoutes.routingEnabled,
			effective_from: v2ModelProviderRoutes.effectiveFrom,
			effective_to: v2ModelProviderRoutes.effectiveTo,
			metadata: v2ModelProviderRoutes.metadata,
		}).from(v2ModelProviderRoutes).where(and(...routeConditions));
		const ids = routes.map(({ provider_model_id }) => provider_model_id).filter(Boolean);
		if (!ids.length) return { routes, capabilities: [] };
		const capabilities = await db.select({
			provider_model_id: v2RouteCapabilities.providerModelId,
			params: v2RouteCapabilities.params,
			max_input_tokens: v2RouteCapabilities.maxInputTokens,
			max_output_tokens: v2RouteCapabilities.maxOutputTokens,
			status: v2RouteCapabilities.status,
			updated_at: v2RouteCapabilities.updatedAt,
			created_at: v2RouteCapabilities.createdAt,
		}).from(v2RouteCapabilities).where(and(
			eq(v2RouteCapabilities.capabilityId, args.capability),
			inArray(v2RouteCapabilities.status, args.capabilityStatuses),
			inArray(v2RouteCapabilities.providerModelId, ids),
		));
		return { routes, capabilities };
	});
}
