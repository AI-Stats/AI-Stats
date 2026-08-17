import { broadcastDestinationKeys, broadcastDestinationRuleGroups, broadcastDestinationRules, keys, workspaceBroadcastDestinations } from "@phaseo/db/schema";
import { and, desc, eq, inArray, ne } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

type RuleGroup = { match: string; rules: Array<{ field: string; condition: string; value: string | null }> };

export async function findBroadcastDestination(env: Env, id: string) {
	const { db, client } = createDatabase(env);
	try { const [row] = await db.select().from(workspaceBroadcastDestinations).where(eq(workspaceBroadcastDestinations.id, id)).limit(1); return row ?? null; }
	finally { await client.end({ timeout: 1 }); }
}

export async function listBroadcastDestinations(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try {
		return await db.select({
			id: workspaceBroadcastDestinations.id,
			destinationId: workspaceBroadcastDestinations.destinationId,
			name: workspaceBroadcastDestinations.name,
			enabled: workspaceBroadcastDestinations.enabled,
			samplingRate: workspaceBroadcastDestinations.samplingRate,
			updatedAt: workspaceBroadcastDestinations.updatedAt,
		}).from(workspaceBroadcastDestinations)
			.where(eq(workspaceBroadcastDestinations.workspaceId, workspaceId))
			.orderBy(desc(workspaceBroadcastDestinations.createdAt));
	} finally { await client.end({ timeout: 1 }); }
}

export async function createBroadcastDestination(env: Env, input: {
	values: typeof workspaceBroadcastDestinations.$inferInsert;
	includeKeyIds: string[];
	excludeKeyIds: string[];
	ruleGroups: RuleGroup[];
}) {
	const { db, client } = createDatabase(env);
	try { return await db.transaction(async (tx) => {
		const requested = [...new Set([...input.includeKeyIds, ...input.excludeKeyIds])];
		if (requested.length) {
			const valid = await tx.select({ id: keys.id }).from(keys).where(and(eq(keys.workspaceId, input.values.workspaceId), ne(keys.status, "deleted"), inArray(keys.id, requested)));
			if (valid.length !== requested.length) throw new Error("One or more API keys are unavailable");
		}
		const [created] = await tx.insert(workspaceBroadcastDestinations).values(input.values).returning({ id: workspaceBroadcastDestinations.id });
		if (!created) throw new Error("broadcast_write_failed");
		if (requested.length) await tx.insert(broadcastDestinationKeys).values(requested.map((keyId) => ({ destinationId: created.id, keyId, filterMode: input.excludeKeyIds.includes(keyId) ? "exclude" : "include" })));
		for (let index = 0; index < input.ruleGroups.length; index += 1) {
			const group = input.ruleGroups[index];
			const [createdGroup] = await tx.insert(broadcastDestinationRuleGroups).values({ destinationId: created.id, name: `Group ${index + 1}`, matchOperator: group.match, position: index }).returning({ id: broadcastDestinationRuleGroups.id });
			if (!createdGroup) throw new Error("broadcast_write_failed");
			if (group.rules.length) await tx.insert(broadcastDestinationRules).values(group.rules.map((rule, position) => ({ ruleGroupId: createdGroup.id, ...rule, position })));
		}
		return created;
	}); } finally { await client.end({ timeout: 1 }); }
}

export async function setBroadcastDestinationEnabled(env: Env, id: string, workspaceId: string, enabled: boolean) {
	const { db, client } = createDatabase(env);
	try { await db.update(workspaceBroadcastDestinations).set({ enabled, updatedAt: new Date().toISOString() }).where(and(eq(workspaceBroadcastDestinations.id, id), eq(workspaceBroadcastDestinations.workspaceId, workspaceId))); }
	finally { await client.end({ timeout: 1 }); }
}

export async function deleteBroadcastDestination(env: Env, id: string, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try { await db.delete(workspaceBroadcastDestinations).where(and(eq(workspaceBroadcastDestinations.id, id), eq(workspaceBroadcastDestinations.workspaceId, workspaceId))); }
	finally { await client.end({ timeout: 1 }); }
}
