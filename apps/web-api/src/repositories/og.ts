import { v2Benchmarks, v2Labs, v2Models, v2Providers, v2SubscriptionPlans } from "@phaseo/db/schema";
import { and, eq } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export type OgDatabaseKind = "organisations" | "models" | "benchmarks" | "api-providers" | "subscription-plans";

export async function findOgPayload(env: Env, kind: OgDatabaseKind, id: string): Promise<Record<string, unknown> | null> {
	const { db, client } = createDatabase(env);
	try {
		if (kind === "organisations") {
			const [row] = await db.select({ id: v2Labs.labSlug, name: v2Labs.name }).from(v2Labs).where(eq(v2Labs.labSlug, id)).limit(1);
			return row ? { id: row.id, name: row.name || row.id, logoId: row.id } : null;
		}
		if (kind === "models") {
			const [row] = await db.select({ id: v2Models.modelSlug, name: v2Models.name, logoId: v2Models.labSlug, badge: v2Models.status }).from(v2Models)
				.where(and(eq(v2Models.modelSlug, id), eq(v2Models.hidden, false))).limit(1);
			return row ? { id: row.id, name: row.name || row.id, logoId: row.logoId, badge: row.badge } : null;
		}
		if (kind === "benchmarks") {
			const [row] = await db.select({ id: v2Benchmarks.benchmarkId, name: v2Benchmarks.name }).from(v2Benchmarks).where(eq(v2Benchmarks.benchmarkId, id)).limit(1);
			return row ? { id: row.id, name: row.name || row.id } : null;
		}
		if (kind === "api-providers") {
			const [row] = await db.select({ id: v2Providers.providerSlug, name: v2Providers.name }).from(v2Providers).where(eq(v2Providers.providerSlug, id)).limit(1);
			return row ? { id: row.id, name: row.name || row.id, logoId: row.id } : null;
		}
		const [row] = await db.select({ id: v2SubscriptionPlans.planId, name: v2SubscriptionPlans.name, logoId: v2SubscriptionPlans.labSlug })
			.from(v2SubscriptionPlans).where(eq(v2SubscriptionPlans.planId, id)).limit(1);
		return row ? { id: row.id, name: row.name || row.id, logoId: row.logoId ?? undefined } : null;
	} finally { await client.end({ timeout: 1 }); }
}
