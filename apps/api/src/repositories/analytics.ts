import { v2ModelProviderRoutes, v2RequestFacts, v2RequestUsage } from "@phaseo/db/schema";
import { and, asc, eq, gte, inArray, lt } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

function range(workspaceId: string, startIso: string, endIso: string) {
	return and(eq(v2RequestFacts.workspaceId, workspaceId), gte(v2RequestFacts.occurredAt, startIso), lt(v2RequestFacts.occurredAt, endIso));
}

export async function countAnalyticsFacts(workspaceId: string, startIso: string, endIso: string): Promise<number> {
	return withDatabase((db) => db.$count(v2RequestFacts, range(workspaceId, startIso, endIso)));
}

export async function loadAnalyticsFactsPage(args: { workspaceId: string; startIso: string; endIso: string; limit: number; offset: number }) {
	return withDatabase(async (db) => {
		const rows = await db.select({
			requestEventId: v2RequestFacts.requestEventId,
			occurredAt: v2RequestFacts.occurredAt,
			endpoint: v2RequestFacts.endpoint,
			requestedModelSlug: v2RequestFacts.requestedModelSlug,
			routedModelSlug: v2RequestFacts.routedModelSlug,
			providerModelId: v2RequestFacts.providerModelId,
			costNanos: v2RequestFacts.costNanos,
			byok: v2RequestFacts.byok,
		}).from(v2RequestFacts).where(range(args.workspaceId, args.startIso, args.endIso))
			.orderBy(asc(v2RequestFacts.occurredAt)).limit(args.limit).offset(args.offset);
		const usageRows = rows.length ? await db.select({
			requestEventId: v2RequestUsage.requestEventId,
			meterKey: v2RequestUsage.meterKey,
			quantity: v2RequestUsage.quantity,
		}).from(v2RequestUsage).where(inArray(v2RequestUsage.requestEventId, rows.map((row) => row.requestEventId))) : [];
		const usageByRequest = new Map<string, Array<{ meter_key: string; quantity: string }>>();
		for (const usage of usageRows) {
			const entries = usageByRequest.get(usage.requestEventId) ?? [];
			entries.push({ meter_key: usage.meterKey, quantity: usage.quantity });
			usageByRequest.set(usage.requestEventId, entries);
		}
		return rows.map((row) => ({
			occurred_at: row.occurredAt, endpoint: row.endpoint, requested_model_slug: row.requestedModelSlug,
			routed_model_slug: row.routedModelSlug, provider_model_id: row.providerModelId,
			cost_nanos: row.costNanos, byok: row.byok,
			v2_request_usage: usageByRequest.get(row.requestEventId) ?? [],
		}));
	});
}

export async function loadAnalyticsProviderNames(providerModelIds: string[]) {
	if (!providerModelIds.length) return [];
	return withDatabase((db) => db.select({ provider_model_id: v2ModelProviderRoutes.providerModelId, provider_slug: v2ModelProviderRoutes.providerSlug })
		.from(v2ModelProviderRoutes).where(inArray(v2ModelProviderRoutes.providerModelId, providerModelIds)));
}
