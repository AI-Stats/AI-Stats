import {
	broadcastDestinationKeys,
	keyGuardrails,
	keys,
	managementKeys,
	workspaces,
} from "@phaseo/db/schema";
import { and, desc, eq, ne, sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

type ApiKeyInsert = typeof keys.$inferInsert;
type ApiKeyUpdate = Partial<typeof keys.$inferInsert>;
type ManagementKeyInsert = typeof managementKeys.$inferInsert;
type ManagementKeyUpdate = Partial<typeof managementKeys.$inferInsert>;

export async function getKeyCapacity(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [[workspace], [api], [management]] = await Promise.all([
			db.select({ tier: workspaces.tier }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
			db.select({ count: sql<number>`count(*)::int` }).from(keys).where(and(
				eq(keys.workspaceId, workspaceId),
				ne(keys.status, "deleted"),
				ne(keys.name, "__chat_route_managed_key__"),
			)),
			db.select({ count: sql<number>`count(*)::int` }).from(managementKeys).where(eq(managementKeys.workspaceId, workspaceId)),
		]);
		return { tier: String(workspace?.tier ?? "basic"), count: Number(api?.count ?? 0) + Number(management?.count ?? 0) };
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function createApiKey(env: Env, values: ApiKeyInsert) {
	const { db, client } = createDatabase(env);
	try {
		const [created] = await db.insert(keys).values(values).returning({ id: keys.id });
		return created ?? null;
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function findApiKey(env: Env, keyId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [key] = await db.select().from(keys).where(eq(keys.id, keyId)).limit(1);
		return key ?? null;
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function listAccountApiKeys(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try {
		const rows = await db.execute<Record<string, unknown>>(sql`
			select * from ${keys}
			where workspace_id=${workspaceId}::uuid and status<>'deleted'
				and name<>'__chat_route_managed_key__'
			order by created_at desc
		`);
		return [...rows];
	} finally { await client.end({ timeout: 1 }); }
}

export async function updateApiKey(env: Env, keyId: string, workspaceId: string, values: ApiKeyUpdate) {
	const { db, client } = createDatabase(env);
	try {
		await db.update(keys).set(values).where(and(eq(keys.id, keyId), eq(keys.workspaceId, workspaceId)));
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function rotateApiKey(
	env: Env,
	values: ApiKeyInsert,
	previous: { id: string; expiresAt?: string | null },
) {
	const { db, client } = createDatabase(env);
	try {
		return await db.transaction(async (tx) => {
			const [created] = await tx.insert(keys).values(values).returning({ id: keys.id });
			if (!created) throw new Error("key_write_failed");
			if (previous.expiresAt !== undefined) {
				await tx.update(keys).set({ expiresAt: previous.expiresAt }).where(eq(keys.id, previous.id));
			}
			return created;
		});
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function deleteApiKey(env: Env, keyId: string, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try {
		await db.transaction(async (tx) => {
			await tx.update(keys).set({
				status: "deleted",
				expiresAt: new Date().toISOString(),
				softBlocked: true,
				hash: `deleted:${keyId}`,
			}).where(and(eq(keys.id, keyId), eq(keys.workspaceId, workspaceId)));
			await tx.delete(keyGuardrails).where(eq(keyGuardrails.keyId, keyId));
			await tx.delete(broadcastDestinationKeys).where(eq(broadcastDestinationKeys.keyId, keyId));
		});
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function createManagementKey(env: Env, values: ManagementKeyInsert) {
	const { db, client } = createDatabase(env);
	try {
		const [created] = await db.insert(managementKeys).values(values).returning({ id: managementKeys.id, createdAt: managementKeys.createdAt });
		return created ?? null;
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function listManagementKeys(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try {
		return await db.select().from(managementKeys).where(eq(managementKeys.workspaceId, workspaceId)).orderBy(desc(managementKeys.createdAt));
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function findManagementKey(env: Env, keyId: string) {
	const { db, client } = createDatabase(env);
	try {
		const [key] = await db.select().from(managementKeys).where(eq(managementKeys.id, keyId)).limit(1);
		return key ?? null;
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function updateManagementKey(env: Env, keyId: string, workspaceId: string, values: ManagementKeyUpdate) {
	const { db, client } = createDatabase(env);
	try {
		await db.update(managementKeys).set(values).where(and(eq(managementKeys.id, keyId), eq(managementKeys.workspaceId, workspaceId)));
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function deleteManagementKey(env: Env, keyId: string, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try {
		await db.delete(managementKeys).where(and(eq(managementKeys.id, keyId), eq(managementKeys.workspaceId, workspaceId)));
	} finally {
		await client.end({ timeout: 1 });
	}
}
