import { v2Labs, v2ModelAliases, v2ModelProviderRoutes, v2Models, v2Providers, v2RouteCapabilities } from "@phaseo/db/schema";
import { and, asc, eq, isNull, notInArray, or } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function listPublicGatewayRows(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		return await db.select({
			providerModelId: v2ModelProviderRoutes.providerModelId, providerId: v2ModelProviderRoutes.providerSlug,
			apiModelId: v2ModelProviderRoutes.modelSlug, modelId: v2ModelProviderRoutes.modelSlug,
			routingEnabled: v2ModelProviderRoutes.routingEnabled, effectiveFrom: v2ModelProviderRoutes.effectiveFrom, effectiveTo: v2ModelProviderRoutes.effectiveTo,
			capabilityId: v2RouteCapabilities.capabilityId, capabilityParams: v2RouteCapabilities.params,
			providerName: v2Providers.name, providerFamilyId: v2Providers.providerFamilySlug, providerOfferLabel: v2Providers.offerLabel,
			providerOfferScope: v2Providers.offerScope, providerPromptTrainingPolicy: v2Providers.promptTrainingPolicy,
			modelName: v2Models.name, modelStatus: v2Models.status, organisationId: v2Models.labSlug,
			previousModelId: v2Models.previousModelSlug, releaseDate: v2Models.releasedAt, announcementDate: v2Models.announcedAt,
			retirementDate: v2Models.retiredAt, organisationName: v2Labs.name,
		}).from(v2ModelProviderRoutes)
			.innerJoin(v2RouteCapabilities, and(
				eq(v2RouteCapabilities.providerModelId, v2ModelProviderRoutes.providerModelId),
				or(isNull(v2RouteCapabilities.status), notInArray(v2RouteCapabilities.status, ["disabled", "internal_testing"])),
			))
			.innerJoin(v2Providers, eq(v2Providers.providerSlug, v2ModelProviderRoutes.providerSlug))
			.innerJoin(v2Models, and(eq(v2Models.modelSlug, v2ModelProviderRoutes.modelSlug), eq(v2Models.hidden, false)))
			.innerJoin(v2Labs, eq(v2Labs.labSlug, v2Models.labSlug))
			.orderBy(asc(v2ModelProviderRoutes.providerSlug), asc(v2ModelProviderRoutes.modelSlug), asc(v2RouteCapabilities.capabilityId))
			.limit(20_000);
	} finally { await client.end({ timeout: 1 }); }
}

export async function listEnabledModelAliases(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		return await db.select({ aliasSlug: v2ModelAliases.aliasSlug, modelSlug: v2ModelAliases.modelSlug })
			.from(v2ModelAliases).where(eq(v2ModelAliases.enabled, true)).orderBy(asc(v2ModelAliases.aliasSlug));
	} finally { await client.end({ timeout: 1 }); }
}
