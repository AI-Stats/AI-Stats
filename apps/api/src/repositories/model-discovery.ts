import { AsyncLocalStorage } from "node:async_hooks";

import { modelDiscoveryRuns, modelDiscoverySeenModels, modelDiscoveryState, v2ModelProviderRoutes, v2PricingSkuMeters, v2PricingSkus } from "@phaseo/db/schema";
import { and, eq, inArray, lt, sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

type DatabaseHandle = ReturnType<typeof createDatabase>;
const databaseContext = new AsyncLocalStorage<DatabaseHandle>();

export async function withModelDiscoveryDatabaseContext<T>(operation: () => Promise<T>): Promise<T> {
	if (databaseContext.getStore()) return operation();
	const handle = createDatabase(getBindings());
	try {
		return await databaseContext.run(handle, operation);
	} finally {
		await handle.client.end({ timeout: 1 });
	}
}

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const active = databaseContext.getStore();
	if (active) return operation(active.db);
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function loadPricingRows() {
	return withDatabase(async (db) => [...await db.execute<Record<string, unknown>>(sql`
		select meter.sku_meter_id::text rule_id, route.provider_slug provider_id, route.model_slug api_model_id,
			sku.operation capability_id, coalesce(sku.service_tier_slug,'standard') pricing_plan,
			meter.meter_key meter, (meter.price_nanos::numeric / 1000000000) price_per_unit,
			sku.currency, sku.effective_from, sku.effective_to,
			greatest(sku.updated_at, meter.updated_at, meter.created_at) updated_at
		from ${v2PricingSkuMeters} meter
		join ${v2PricingSkus} sku on sku.sku_id=meter.sku_id
		join ${v2ModelProviderRoutes} route on route.provider_model_id=sku.provider_model_id
		where meter.billable=true
		order by greatest(sku.updated_at, meter.updated_at, meter.created_at), meter.sku_meter_id
	`)]);
}

export async function getStateValue(scope: string, stateKey: string): Promise<unknown | null> {
	return withDatabase(async (db) => {
		const [row] = await db.select({ value: modelDiscoveryState.value })
			.from(modelDiscoveryState)
			.where(and(eq(modelDiscoveryState.scope, scope), eq(modelDiscoveryState.stateKey, stateKey)))
			.limit(1);
		return row?.value ?? null;
	});
}

export async function setStateValue(scope: string, stateKey: string, value: unknown, observedAt: string): Promise<void> {
	await withDatabase(async (db) => {
		await db.execute(sql`
			insert into ${modelDiscoveryState} (scope, state_key, value, updated_at)
			values (${scope}, ${stateKey}, ${JSON.stringify(value)}::jsonb, ${observedAt}::timestamptz)
			on conflict (scope, state_key) do update
			set value = excluded.value, updated_at = excluded.updated_at
			where excluded.updated_at >= ${modelDiscoveryState.updatedAt}
		`);
	});
}

export async function listConfiguredRoutes(providerIds: string[]) {
	return withDatabase((db) => db.select({ provider_id: v2ModelProviderRoutes.providerSlug, provider_model_slug: v2ModelProviderRoutes.providerModelSlug, api_model_id: v2ModelProviderRoutes.modelSlug }).from(v2ModelProviderRoutes).where(inArray(v2ModelProviderRoutes.providerSlug, providerIds)));
}

export async function insertRun(values: typeof modelDiscoveryRuns.$inferInsert): Promise<void> {
	await withDatabase(async (db) => { await db.insert(modelDiscoveryRuns).values(values); });
}

export async function finishRun(id: string, patch: Partial<typeof modelDiscoveryRuns.$inferInsert>): Promise<void> {
	await withDatabase(async (db) => { await db.update(modelDiscoveryRuns).set(patch).where(eq(modelDiscoveryRuns.id, id)); });
}

export async function listSeenModels(providerIds: string[]) {
	return withDatabase((db) => db.select({ provider_id: modelDiscoverySeenModels.providerId, model_id: modelDiscoverySeenModels.modelId, model_details: modelDiscoverySeenModels.modelDetails, pricing_details: modelDiscoverySeenModels.pricingDetails, removal_pending: modelDiscoverySeenModels.removalPending }).from(modelDiscoverySeenModels).where(inArray(modelDiscoverySeenModels.providerId, providerIds)).orderBy(modelDiscoverySeenModels.providerId, modelDiscoverySeenModels.modelId));
}

export async function upsertSeenModels(rows: Array<typeof modelDiscoverySeenModels.$inferInsert>): Promise<void> {
	if (!rows.length) return;
	await withDatabase(async (db) => { await db.insert(modelDiscoverySeenModels).values(rows).onConflictDoUpdate({ target: [modelDiscoverySeenModels.providerId, modelDiscoverySeenModels.modelId], set: { providerName: sql`excluded.provider_name`, lastSeenAt: sql`excluded.last_seen_at`, lastRunId: sql`excluded.last_run_id`, modelDetails: sql`excluded.model_details`, pricingDetails: sql`excluded.pricing_details`, removalPending: sql`excluded.removal_pending` } }); });
}

export async function deleteSeenModels(providerId: string, modelIds: string[]): Promise<number> {
	return withDatabase(async (db) => (await db.delete(modelDiscoverySeenModels).where(and(eq(modelDiscoverySeenModels.providerId, providerId), inArray(modelDiscoverySeenModels.modelId, modelIds))).returning({ id: modelDiscoverySeenModels.modelId })).length);
}

export async function markPendingRemovals(providerId: string, modelIds: string[], lastSeenAt: string): Promise<void> {
	await withDatabase(async (db) => { await db.update(modelDiscoverySeenModels).set({ removalPending: true, lastSeenAt }).where(and(eq(modelDiscoverySeenModels.providerId, providerId), inArray(modelDiscoverySeenModels.modelId, modelIds))); });
}

export async function pruneSeenModels(cutoff: string): Promise<number> {
	return withDatabase(async (db) => (await db.delete(modelDiscoverySeenModels).where(lt(modelDiscoverySeenModels.lastSeenAt, cutoff)).returning({ id: modelDiscoverySeenModels.modelId })).length);
}

export async function pruneRuns(cutoff: string): Promise<void> {
	await withDatabase(async (db) => { await db.delete(modelDiscoveryRuns).where(lt(modelDiscoveryRuns.startedAt, cutoff)); });
}
