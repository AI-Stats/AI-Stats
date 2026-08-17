import { dataContributionConsentEvents, dataContributions, keys, requestClassificationDaily, users, workspaceClassifiers, workspaceSettings } from "@phaseo/db/schema";
import { and, asc, desc, eq, gte, ne, sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

export type ClassifierPatch = Partial<Pick<typeof workspaceClassifiers.$inferInsert, "name" | "description" | "instructions" | "categories" | "model" | "serviceTier" | "sampleRateBps" | "enabled">>;
export type ConsentArgs = { workspaceId: string; enabled: boolean; actorType: "user" | "management_key"; actorUserId: string | null; actorKeyId: string | null; reason: string | null; policyVersion: string; sampleRateBps: number; classifierSampleRateBps: number; discountBps: number };

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function auditConsentEvent(values: typeof dataContributionConsentEvents.$inferInsert): Promise<void> {
	await withDatabase(async (db) => { await db.insert(dataContributionConsentEvents).values(values); });
}

export async function isPhaseoAdmin(userId: string): Promise<boolean> {
	return withDatabase(async (db) => (await db.query.users.findFirst({ columns: { role: true }, where: eq(users.userId, userId) }))?.role === "admin");
}

export async function listWorkspaceKeyIds(workspaceId: string): Promise<string[]> {
	return withDatabase(async (db) => (await db.select({ id: keys.id }).from(keys).where(and(eq(keys.workspaceId, workspaceId), ne(keys.status, "deleted")))).map(({ id }) => id));
}

export async function loadDataContributionOverview(workspaceId: string, sinceIso: string, sinceDate: string) {
	return withDatabase(async (db) => {
		const [settings, classifiers, totals, analytics] = await Promise.all([
			db.query.workspaceSettings.findFirst({ columns: { dataContributionEnabled: true, dataContributionPolicyVersion: true, dataContributionConsentedAt: true, dataContributionSampleRateBps: true, dataContributionClassifierSampleRateBps: true, dataContributionDiscountBps: true }, where: eq(workspaceSettings.workspaceId, workspaceId) }),
			db.select().from(workspaceClassifiers).where(eq(workspaceClassifiers.workspaceId, workspaceId)).orderBy(asc(workspaceClassifiers.createdAt)),
			db.select({ contributions: sql<number>`count(*)`, discountNanos: sql<number>`coalesce(sum(${dataContributions.discountNanos}), 0)` }).from(dataContributions).where(and(eq(dataContributions.workspaceId, workspaceId), gte(dataContributions.createdAt, sinceIso))),
			db.select().from(requestClassificationDaily).where(and(eq(requestClassificationDaily.workspaceId, workspaceId), gte(requestClassificationDaily.usageDate, sinceDate))).orderBy(desc(requestClassificationDaily.usageDate)).limit(1000),
		]);
		return { settings: settings ?? null, classifiers, totals: totals[0] ?? { contributions: 0, discountNanos: 0 }, analytics };
	});
}

export async function setDataContributionConsent(args: ConsentArgs): Promise<void> {
	await withDatabase(async (db) => db.transaction(async (tx) => {
		const now = new Date().toISOString();
		await tx.insert(workspaceSettings).values({
			workspaceId: args.workspaceId, dataContributionEnabled: args.enabled, dataContributionPolicyVersion: args.policyVersion,
			dataContributionConsentedAt: args.enabled ? now : null, dataContributionConsentedBy: args.enabled ? args.actorUserId : null,
			dataContributionSampleRateBps: args.sampleRateBps, dataContributionClassifierSampleRateBps: args.classifierSampleRateBps,
			dataContributionDiscountBps: args.discountBps, updatedAt: now,
		}).onConflictDoUpdate({ target: workspaceSettings.workspaceId, set: {
			dataContributionEnabled: args.enabled, dataContributionPolicyVersion: args.policyVersion,
			dataContributionConsentedAt: args.enabled ? now : null, dataContributionConsentedBy: args.enabled ? args.actorUserId : null,
			dataContributionSampleRateBps: args.sampleRateBps, dataContributionClassifierSampleRateBps: args.classifierSampleRateBps,
			dataContributionDiscountBps: args.discountBps, updatedAt: now,
		} });
		await tx.insert(dataContributionConsentEvents).values({ workspaceId: args.workspaceId, actorType: args.actorType, actorUserId: args.actorUserId, actorKeyId: args.actorKeyId, action: args.enabled ? "enabled" : "disabled", outcome: "succeeded", policyVersion: args.policyVersion, sampleRateBps: args.sampleRateBps, classifierSampleRateBps: args.classifierSampleRateBps, discountBps: args.discountBps, reason: args.reason });
		if (!args.enabled) await tx.update(dataContributions).set({ retentionUntil: sql`least(${dataContributions.retentionUntil}, now())`, availableAt: sql`greatest(${dataContributions.availableAt}, now())`, updatedAt: now }).where(and(eq(dataContributions.workspaceId, args.workspaceId), ne(dataContributions.status, "deleted")));
	}));
}

export async function createClassifier(workspaceId: string, slug: string, createdBy: string | null, patch: ClassifierPatch) {
	return withDatabase(async (db) => { const [row] = await db.insert(workspaceClassifiers).values({ workspaceId, slug, kind: "custom", createdBy, ...patch } as typeof workspaceClassifiers.$inferInsert).returning(); if (!row) throw new Error("Failed to create classifier"); return row; });
}

export async function updateClassifier(workspaceId: string, id: string, patch: ClassifierPatch) {
	return withDatabase(async (db) => { const [row] = await db.update(workspaceClassifiers).set({ ...patch, updatedAt: new Date().toISOString() }).where(and(eq(workspaceClassifiers.id, id), eq(workspaceClassifiers.workspaceId, workspaceId), eq(workspaceClassifiers.kind, "custom"))).returning(); return row ?? null; });
}

export async function deleteClassifier(workspaceId: string, id: string): Promise<boolean> {
	return withDatabase(async (db) => (await db.delete(workspaceClassifiers).where(and(eq(workspaceClassifiers.id, id), eq(workspaceClassifiers.workspaceId, workspaceId), eq(workspaceClassifiers.kind, "custom"))).returning({ id: workspaceClassifiers.id })).length > 0);
}
