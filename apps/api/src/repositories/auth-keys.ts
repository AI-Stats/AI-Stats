import { keys, managementKeys } from "@phaseo/db/schema";
import { eq } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function findGatewayKeyByKid(kid: string) {
	return withDatabase(async (db) => (await db.select({
		id: keys.id,
		workspace_id: keys.workspaceId,
		status: keys.status,
		hash: keys.hash,
		expires_at: keys.expiresAt,
		soft_blocked: keys.softBlocked,
		scopes: keys.scopes,
		key_kind: keys.keyKind,
		oauth_client_id: keys.oauthClientId,
		oauth_user_id: keys.oauthUserId,
		oauth_scopes: keys.oauthScopes,
		oauth_resource: keys.oauthResource,
	}).from(keys).where(eq(keys.kid, kid)).limit(1))[0] ?? null);
}

export async function touchGatewayKey(id: string, lastUsedAt: string, hash?: string | null): Promise<void> {
	await withDatabase(async (db) => {
		await db.update(keys).set({ lastUsedAt, ...(hash ? { hash } : {}) }).where(eq(keys.id, id));
	});
}

export async function findManagementKeyByKid(kid: string) {
	return withDatabase(async (db) => (await db.select({
		id: managementKeys.id,
		workspace_id: managementKeys.workspaceId,
		status: managementKeys.status,
		hash: managementKeys.hash,
		expires_at: managementKeys.expiresAt,
		soft_blocked: managementKeys.softBlocked,
		scopes: managementKeys.scopes,
	}).from(managementKeys).where(eq(managementKeys.kid, kid)).limit(1))[0] ?? null);
}

export async function touchManagementKey(id: string, lastUsedAt: string, hash?: string | null): Promise<void> {
	await withDatabase(async (db) => {
		await db.update(managementKeys).set({ lastUsedAt, ...(hash ? { hash } : {}) }).where(eq(managementKeys.id, id));
	});
}
