import { byokKeys, workspaceByokMonthlyUsage, workspaceSettings } from "@phaseo/db/schema";
import { and, asc, desc, eq, gte, gt, lt, ne, sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function findByokKey(env: Env, keyId: string) {
	const { db, client } = createDatabase(env);
	try { const [row] = await db.select().from(byokKeys).where(eq(byokKeys.id, keyId)).limit(1); return row ?? null; }
	finally { await client.end({ timeout: 1 }); }
}

export async function loadWorkspaceByokSettings(env: Env, input: { workspaceId: string; monthStart: string; nextMonthStart: string }) {
	const { db, client } = createDatabase(env);
	try {
		const [keyEntries, [usage], [settings]] = await Promise.all([
			db.select().from(byokKeys).where(eq(byokKeys.workspaceId, input.workspaceId))
				.orderBy(asc(byokKeys.routingMode), asc(byokKeys.sortOrder), asc(byokKeys.createdAt)),
			db.select({ requestCount: workspaceByokMonthlyUsage.requestCount }).from(workspaceByokMonthlyUsage)
				.where(and(eq(workspaceByokMonthlyUsage.workspaceId, input.workspaceId), gte(workspaceByokMonthlyUsage.monthStart, input.monthStart), lt(workspaceByokMonthlyUsage.monthStart, input.nextMonthStart)))
				.orderBy(desc(workspaceByokMonthlyUsage.monthStart)).limit(1),
			db.select({ fallbackEnabled: workspaceSettings.byokFallbackEnabled }).from(workspaceSettings)
				.where(eq(workspaceSettings.workspaceId, input.workspaceId)).limit(1),
		]);
		return { keyEntries, monthlyRequestCount: Number(usage?.requestCount ?? 0), fallbackEnabled: settings?.fallbackEnabled === true };
	} finally { await client.end({ timeout: 1 }); }
}

export async function getByokModeCapacity(env: Env, input: { workspaceId: string; providerId: string; routingMode: string; excludeId?: string }) {
	const { db, client } = createDatabase(env);
	try {
		const where = and(eq(byokKeys.workspaceId, input.workspaceId), eq(byokKeys.providerId, input.providerId), eq(byokKeys.routingMode, input.routingMode), input.excludeId ? ne(byokKeys.id, input.excludeId) : undefined);
		const [[count], [last]] = await Promise.all([
			db.select({ value: sql<number>`count(*)::int` }).from(byokKeys).where(where),
			db.select({ sortOrder: byokKeys.sortOrder }).from(byokKeys).where(where).orderBy(desc(byokKeys.sortOrder)).limit(1),
		]);
		return { count: Number(count?.value ?? 0), nextSortOrder: Number(last?.sortOrder ?? -1) + 1 };
	} finally { await client.end({ timeout: 1 }); }
}

export async function createByokKey(env: Env, values: typeof byokKeys.$inferInsert) {
	const { db, client } = createDatabase(env);
	try { const [row] = await db.insert(byokKeys).values(values).returning({ id: byokKeys.id }); return row ?? null; }
	finally { await client.end({ timeout: 1 }); }
}

export async function updateByokKey(env: Env, keyId: string, workspaceId: string, values: Partial<typeof byokKeys.$inferInsert>) {
	const { db, client } = createDatabase(env);
	try { await db.update(byokKeys).set(values).where(and(eq(byokKeys.id, keyId), eq(byokKeys.workspaceId, workspaceId))); }
	finally { await client.end({ timeout: 1 }); }
}

export async function deleteByokKey(env: Env, keyId: string, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try { await db.delete(byokKeys).where(and(eq(byokKeys.id, keyId), eq(byokKeys.workspaceId, workspaceId))); }
	finally { await client.end({ timeout: 1 }); }
}

export async function reorderByokKey(env: Env, keyId: string, workspaceId: string, direction: "up" | "down") {
	const { db, client } = createDatabase(env);
	try {
		return await db.transaction(async (tx) => {
			const [candidate] = await tx.select().from(byokKeys).where(and(eq(byokKeys.id, keyId), eq(byokKeys.workspaceId, workspaceId))).limit(1);
			if (!candidate) return false;
			await tx.execute(sql`select id from ${byokKeys} where workspace_id=${workspaceId}::uuid and provider_id=${candidate.providerId} and routing_mode=${candidate.routingMode} order by id for update`);
			const [current] = await tx.select().from(byokKeys).where(and(eq(byokKeys.id, keyId), eq(byokKeys.workspaceId, workspaceId))).limit(1);
			if (!current) return false;
			const comparator = direction === "up" ? lt(byokKeys.sortOrder, current.sortOrder) : gt(byokKeys.sortOrder, current.sortOrder);
			const ordering = direction === "up" ? desc(byokKeys.sortOrder) : asc(byokKeys.sortOrder);
			const [neighbor] = await tx.select().from(byokKeys).where(and(
				eq(byokKeys.workspaceId, workspaceId), eq(byokKeys.providerId, current.providerId), eq(byokKeys.routingMode, current.routingMode), comparator,
			)).orderBy(ordering).limit(1);
			if (!neighbor) return true;
			await tx.update(byokKeys).set({ sortOrder: neighbor.sortOrder }).where(eq(byokKeys.id, current.id));
			await tx.update(byokKeys).set({ sortOrder: current.sortOrder }).where(eq(byokKeys.id, neighbor.id));
			return true;
		});
	} finally { await client.end({ timeout: 1 }); }
}

export async function setByokFallback(env: Env, workspaceId: string, enabled: boolean) {
	const { db, client } = createDatabase(env);
	try {
		await db.insert(workspaceSettings).values({ workspaceId, byokFallbackEnabled: enabled, routingMode: "balanced" }).onConflictDoUpdate({
			target: workspaceSettings.workspaceId,
			set: { byokFallbackEnabled: enabled, updatedAt: new Date().toISOString() },
		});
	} finally { await client.end({ timeout: 1 }); }
}
