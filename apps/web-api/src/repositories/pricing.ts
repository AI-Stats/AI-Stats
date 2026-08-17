import { v2ModelProviderRoutes, v2Models, v2PricingSkuMeters, v2PricingSkus } from "@phaseo/db/schema";
import { and, asc, eq, gt, inArray, isNull, lte, ne, or } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function listPublicPricingRows(env: Env, requestedModelIds: string[]) {
	const modelIds = [...new Set(requestedModelIds)].filter(Boolean).slice(0, 100);
	const now = new Date().toISOString();
	const routeConditions = [
		eq(v2ModelProviderRoutes.routingEnabled, true),
		inArray(v2ModelProviderRoutes.status, ["active", "degraded"]),
		or(isNull(v2ModelProviderRoutes.effectiveFrom), lte(v2ModelProviderRoutes.effectiveFrom, now)),
		or(isNull(v2ModelProviderRoutes.effectiveTo), gt(v2ModelProviderRoutes.effectiveTo, now)),
	];
	if (modelIds.length) routeConditions.push(inArray(v2ModelProviderRoutes.modelSlug, modelIds));

	const { db, client } = createDatabase(env);
	try {
		return await db.select({
			providerModelId: v2ModelProviderRoutes.providerModelId,
			providerSlug: v2ModelProviderRoutes.providerSlug,
			providerModelSlug: v2ModelProviderRoutes.providerModelSlug,
			modelSlug: v2ModelProviderRoutes.modelSlug,
			modelName: v2Models.name,
			releasedAt: v2Models.releasedAt,
			announcedAt: v2Models.announcedAt,
			skuId: v2PricingSkus.skuId,
			operation: v2PricingSkus.operation,
			serviceTierSlug: v2PricingSkus.serviceTierSlug,
			currency: v2PricingSkus.currency,
			skuMetadata: v2PricingSkus.metadata,
			meterKey: v2PricingSkuMeters.meterKey,
			unit: v2PricingSkuMeters.unit,
			unitQuantity: v2PricingSkuMeters.unitQuantity,
			priceNanos: v2PricingSkuMeters.priceNanos,
			meterMetadata: v2PricingSkuMeters.metadata,
		}).from(v2ModelProviderRoutes)
			.innerJoin(v2Models, and(eq(v2Models.modelSlug, v2ModelProviderRoutes.modelSlug), eq(v2Models.hidden, false)))
			.innerJoin(v2PricingSkus, and(
				eq(v2PricingSkus.providerModelId, v2ModelProviderRoutes.providerModelId),
				ne(v2PricingSkus.status, "disabled"),
				lte(v2PricingSkus.effectiveFrom, now),
				or(isNull(v2PricingSkus.effectiveTo), gt(v2PricingSkus.effectiveTo, now)),
			))
			.innerJoin(v2PricingSkuMeters, eq(v2PricingSkuMeters.skuId, v2PricingSkus.skuId))
			.where(and(...routeConditions))
			.orderBy(asc(v2ModelProviderRoutes.providerSlug), asc(v2ModelProviderRoutes.modelSlug), asc(v2PricingSkus.operation), asc(v2PricingSkuMeters.meterOrder))
			.limit(20_000);
	} finally {
		await client.end({ timeout: 1 });
	}
}
