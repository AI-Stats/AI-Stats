import {
	v2ModelProviderRoutes,
	v2Models,
	v2PricingSkuMeters,
	v2PricingSkus,
} from "@phaseo/db/schema";
import { and, asc, desc, eq, gt, inArray, isNull, lte, or } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try {
		return await operation(db);
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function loadActivePriceRows(provider: string, model: string, operation: string) {
	return withDatabase(async (db) => {
		const routes = await db.select({
			providerModelId: v2ModelProviderRoutes.providerModelId,
			modelSlug: v2ModelProviderRoutes.modelSlug,
			providerModelSlug: v2ModelProviderRoutes.providerModelSlug,
		}).from(v2ModelProviderRoutes).where(and(
			eq(v2ModelProviderRoutes.providerSlug, provider),
			or(eq(v2ModelProviderRoutes.modelSlug, model), eq(v2ModelProviderRoutes.providerModelSlug, model)),
			inArray(v2ModelProviderRoutes.status, ["active", "degraded"]),
			eq(v2ModelProviderRoutes.routingEnabled, true),
		));
		const routeIds = Array.from(new Set(routes.map((route) => route.providerModelId)));
		if (!routeIds.length) return { routes, skus: [], meters: [] };
		const now = new Date().toISOString();
		const skus = await db.select().from(v2PricingSkus).where(and(
			inArray(v2PricingSkus.providerModelId, routeIds),
			eq(v2PricingSkus.operation, operation),
			eq(v2PricingSkus.status, "active"),
			lte(v2PricingSkus.effectiveFrom, now),
			or(isNull(v2PricingSkus.effectiveTo), gt(v2PricingSkus.effectiveTo, now)),
		)).orderBy(desc(v2PricingSkus.effectiveFrom));
		if (!skus.length) return { routes, skus, meters: [] };
		const meters = await db.select().from(v2PricingSkuMeters).where(and(
			inArray(v2PricingSkuMeters.skuId, skus.map((sku) => sku.skuId)),
			eq(v2PricingSkuMeters.billable, true),
		)).orderBy(asc(v2PricingSkuMeters.meterOrder));
		return { routes, skus, meters };
	});
}

export async function loadPricingCatalogueRows() {
	return withDatabase(async (db) => {
		const now = new Date().toISOString();
		const [routes, models, skus] = await Promise.all([
			db.select({
				providerModelId: v2ModelProviderRoutes.providerModelId,
				providerSlug: v2ModelProviderRoutes.providerSlug,
				modelSlug: v2ModelProviderRoutes.modelSlug,
			}).from(v2ModelProviderRoutes).where(and(
				eq(v2ModelProviderRoutes.routingEnabled, true),
				inArray(v2ModelProviderRoutes.status, ["active", "degraded"]),
			)),
			db.select({
				modelSlug: v2Models.modelSlug,
				name: v2Models.name,
				hidden: v2Models.hidden,
				status: v2Models.status,
			}).from(v2Models),
			db.select().from(v2PricingSkus).where(and(
				eq(v2PricingSkus.status, "active"),
				lte(v2PricingSkus.effectiveFrom, now),
				or(isNull(v2PricingSkus.effectiveTo), gt(v2PricingSkus.effectiveTo, now)),
			)),
		]);
		const meters = skus.length ? await db.select().from(v2PricingSkuMeters).where(and(
			inArray(v2PricingSkuMeters.skuId, skus.map((sku) => sku.skuId)),
			eq(v2PricingSkuMeters.billable, true),
		)).orderBy(asc(v2PricingSkuMeters.meterOrder)) : [];
		return { routes, models, skus, meters };
	});
}

export async function loadCataloguePricingRows(providerModelIds: string[]) {
	if (!providerModelIds.length) return { skus: [], meters: [] };
	return withDatabase(async (db) => {
		const skus = await db.select().from(v2PricingSkus)
			.where(inArray(v2PricingSkus.providerModelId, providerModelIds));
		const meters = skus.length ? await db.select().from(v2PricingSkuMeters).where(and(
			inArray(v2PricingSkuMeters.skuId, skus.map((sku) => sku.skuId)),
			eq(v2PricingSkuMeters.billable, true),
		)) : [];
		return { skus, meters };
	});
}
