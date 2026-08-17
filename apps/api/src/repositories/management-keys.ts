import { managementKeys } from "@phaseo/db/schema";
import { and, desc, eq } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

const selection = {
	id: managementKeys.id,
	workspace_id: managementKeys.workspaceId,
	name: managementKeys.name,
	prefix: managementKeys.prefix,
	status: managementKeys.status,
	scopes: managementKeys.scopes,
	created_by: managementKeys.createdBy,
	created_at: managementKeys.createdAt,
	last_used_at: managementKeys.lastUsedAt,
	expires_at: managementKeys.expiresAt,
	soft_blocked: managementKeys.softBlocked,
};

type ManagementKeyPatch = Partial<Pick<typeof managementKeys.$inferInsert, "name" | "status" | "scopes" | "expiresAt" | "softBlocked">>;

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function createManagementKey(values: typeof managementKeys.$inferInsert) {
	return withDatabase(async (db) => {
		const [row] = await db.insert(managementKeys).values(values).returning(selection);
		if (!row) throw new Error("Failed to create management key");
		return row;
	});
}

export async function listManagementKeys(workspaceId: string, limit: number, offset: number) {
	return withDatabase((db) => db.select(selection).from(managementKeys)
		.where(eq(managementKeys.workspaceId, workspaceId))
		.orderBy(desc(managementKeys.createdAt)).limit(limit).offset(offset));
}

export async function findManagementKey(workspaceId: string, id: string) {
	return withDatabase(async (db) => {
		const [row] = await db.select(selection).from(managementKeys)
			.where(and(eq(managementKeys.workspaceId, workspaceId), eq(managementKeys.id, id))).limit(1);
		return row ?? null;
	});
}

export async function updateManagementKey(workspaceId: string, id: string, patch: ManagementKeyPatch) {
	return withDatabase(async (db) => {
		const [row] = await db.update(managementKeys).set(patch)
			.where(and(eq(managementKeys.workspaceId, workspaceId), eq(managementKeys.id, id))).returning(selection);
		return row ?? null;
	});
}

export async function deleteManagementKey(workspaceId: string, id: string): Promise<boolean> {
	return withDatabase(async (db) => {
		const rows = await db.delete(managementKeys)
			.where(and(eq(managementKeys.workspaceId, workspaceId), eq(managementKeys.id, id))).returning({ id: managementKeys.id });
		return rows.length > 0;
	});
}
