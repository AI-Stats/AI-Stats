import { gatewayWebhookEndpoints } from "@phaseo/db/schema";
import { and, desc, eq, ne } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

const selection = {
	id: gatewayWebhookEndpoints.id,
	workspace_id: gatewayWebhookEndpoints.workspaceId,
	name: gatewayWebhookEndpoints.name,
	url: gatewayWebhookEndpoints.url,
	status: gatewayWebhookEndpoints.status,
	events: gatewayWebhookEndpoints.events,
	secret_ciphertext: gatewayWebhookEndpoints.secretCiphertext,
	secret_iv: gatewayWebhookEndpoints.secretIv,
	secret_hash: gatewayWebhookEndpoints.secretHash,
	secret_key_version: gatewayWebhookEndpoints.secretKeyVersion,
	created_by: gatewayWebhookEndpoints.createdBy,
	created_at: gatewayWebhookEndpoints.createdAt,
	updated_at: gatewayWebhookEndpoints.updatedAt,
	deleted_at: gatewayWebhookEndpoints.deletedAt,
};

export type WebhookEndpointPatch = Partial<Pick<typeof gatewayWebhookEndpoints.$inferInsert,
	"name" | "url" | "events" | "status" | "secretCiphertext" | "secretIv" | "secretHash" | "secretKeyVersion" | "deletedAt"
>>;

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function listWebhookEndpoints(args: { workspaceId: string; includeDeleted: boolean; limit: number; offset: number }) {
	return withDatabase((db) => {
		const where = args.includeDeleted
			? eq(gatewayWebhookEndpoints.workspaceId, args.workspaceId)
			: and(eq(gatewayWebhookEndpoints.workspaceId, args.workspaceId), ne(gatewayWebhookEndpoints.status, "deleted"));
		return db.select(selection).from(gatewayWebhookEndpoints).where(where)
			.orderBy(desc(gatewayWebhookEndpoints.createdAt)).limit(args.limit).offset(args.offset);
	});
}

export async function createWebhookEndpoint(values: typeof gatewayWebhookEndpoints.$inferInsert) {
	return withDatabase(async (db) => {
		const [row] = await db.insert(gatewayWebhookEndpoints).values(values).returning(selection);
		if (!row) throw new Error("Failed to create webhook endpoint");
		return row;
	});
}

export async function findWebhookEndpoint(workspaceId: string, id: string, includeDeleted = false) {
	return withDatabase(async (db) => {
		const conditions = [eq(gatewayWebhookEndpoints.workspaceId, workspaceId), eq(gatewayWebhookEndpoints.id, id)];
		if (!includeDeleted) conditions.push(ne(gatewayWebhookEndpoints.status, "deleted"));
		const [row] = await db.select(selection).from(gatewayWebhookEndpoints).where(and(...conditions)).limit(1);
		return row ?? null;
	});
}

export async function updateWebhookEndpoint(workspaceId: string, id: string, patch: WebhookEndpointPatch) {
	return withDatabase(async (db) => {
		const [row] = await db.update(gatewayWebhookEndpoints).set({ ...patch, updatedAt: new Date().toISOString() })
			.where(and(eq(gatewayWebhookEndpoints.workspaceId, workspaceId), eq(gatewayWebhookEndpoints.id, id), ne(gatewayWebhookEndpoints.status, "deleted")))
			.returning(selection);
		return row ?? null;
	});
}

export async function deleteWebhookEndpoint(workspaceId: string, id: string): Promise<boolean> {
	return withDatabase(async (db) => {
		const now = new Date().toISOString();
		const rows = await db.update(gatewayWebhookEndpoints).set({ status: "deleted", deletedAt: now, updatedAt: now })
			.where(and(eq(gatewayWebhookEndpoints.workspaceId, workspaceId), eq(gatewayWebhookEndpoints.id, id), ne(gatewayWebhookEndpoints.status, "deleted")))
			.returning({ id: gatewayWebhookEndpoints.id });
		return rows.length > 0;
	});
}
