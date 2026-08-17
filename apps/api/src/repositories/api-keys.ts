import { broadcastDestinationKeys, keyGuardrails, keys } from "@phaseo/db/schema";
import { and, desc, eq, ne } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

const keySelection = {
	id: keys.id,
	hash: keys.hash,
	workspace_id: keys.workspaceId,
	name: keys.name,
	prefix: keys.prefix,
	status: keys.status,
	created_by: keys.createdBy,
	created_at: keys.createdAt,
	last_used_at: keys.lastUsedAt,
	soft_blocked: keys.softBlocked,
	expires_at: keys.expiresAt,
	kid: keys.kid,
	daily_limit_cost_nanos: keys.dailyLimitCostNanos,
	weekly_limit_cost_nanos: keys.weeklyLimitCostNanos,
	monthly_limit_cost_nanos: keys.monthlyLimitCostNanos,
};

export type ApiKeyInsert = typeof keys.$inferInsert;
export type ApiKeyUpdate = Partial<Pick<ApiKeyInsert,
	"name" | "status" | "softBlocked" | "expiresAt" | "hash" |
	"dailyLimitCostNanos" | "weeklyLimitCostNanos" | "monthlyLimitCostNanos"
>>;

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

function identifierCondition(identifier: string) {
	const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
	return isId ? eq(keys.id, identifier) : eq(keys.hash, identifier);
}

export async function findApiKeyByIdAndWorkspace(id: string, workspaceId: string) {
	return withDatabase(async (db) => {
		const [row] = await db.select(keySelection).from(keys).where(and(eq(keys.id, id), eq(keys.workspaceId, workspaceId))).limit(1);
		return row ?? null;
	});
}

export async function findApiKey(identifier: string, workspaceId: string, excludedName?: string) {
	return withDatabase(async (db) => {
		const conditions = [eq(keys.workspaceId, workspaceId), identifierCondition(identifier)];
		if (excludedName) conditions.push(ne(keys.name, excludedName));
		const [row] = await db.select(keySelection).from(keys).where(and(...conditions)).limit(1);
		return row ?? null;
	});
}

export async function findApiKeyForInvalidation(id: string) {
	return withDatabase(async (db) => {
		const [row] = await db.select({ id: keys.id, kid: keys.kid, status: keys.status, workspace_id: keys.workspaceId })
			.from(keys).where(eq(keys.id, id)).limit(1);
		return row ?? null;
	});
}

export async function listApiKeys(args: { workspaceId: string; excludedName: string; includeDisabled: boolean; limit: number; offset: number }) {
	return withDatabase(async (db) => {
		const conditions = [eq(keys.workspaceId, args.workspaceId), ne(keys.name, args.excludedName)];
		if (!args.includeDisabled) conditions.push(eq(keys.status, "active"), eq(keys.softBlocked, false));
		const where = and(...conditions);
		const [total, rows] = await Promise.all([
			db.$count(keys, where),
			db.select(keySelection).from(keys).where(where).orderBy(desc(keys.createdAt)).limit(args.limit).offset(args.offset),
		]);
		return { total, rows };
	});
}

export async function createApiKey(values: ApiKeyInsert) {
	return withDatabase(async (db) => {
		const [row] = await db.insert(keys).values(values).returning(keySelection);
		if (!row) throw new Error("Failed to create API key");
		return row;
	});
}

export async function updateApiKey(id: string, workspaceId: string, patch: ApiKeyUpdate) {
	return withDatabase(async (db) => {
		const [row] = await db.update(keys).set(patch).where(and(eq(keys.id, id), eq(keys.workspaceId, workspaceId))).returning(keySelection);
		return row ?? null;
	});
}

export async function tombstoneApiKey(id: string, workspaceId: string, deletedAt: string): Promise<void> {
	await withDatabase(async (db) => {
		await db.transaction(async (tx) => {
			await tx.update(keys).set({ status: "deleted", expiresAt: deletedAt, softBlocked: true, hash: `deleted:${id}` })
				.where(and(eq(keys.id, id), eq(keys.workspaceId, workspaceId)));
			await tx.delete(keyGuardrails).where(eq(keyGuardrails.keyId, id));
			await tx.delete(broadcastDestinationKeys).where(eq(broadcastDestinationKeys.keyId, id));
		});
	});
}
