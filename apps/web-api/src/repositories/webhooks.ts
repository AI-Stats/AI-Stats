import { gatewayWebhookEndpoints } from "@phaseo/db/schema";
import { and, desc, eq, ne } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function listWebhookEndpoints(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try {
		return await db.select().from(gatewayWebhookEndpoints).where(and(
			eq(gatewayWebhookEndpoints.workspaceId, workspaceId),
			ne(gatewayWebhookEndpoints.status, "deleted"),
		)).orderBy(desc(gatewayWebhookEndpoints.createdAt));
	} finally { await client.end({ timeout: 1 }); }
}

export async function createWebhookEndpoint(env: Env, values: typeof gatewayWebhookEndpoints.$inferInsert) {
	const { db, client } = createDatabase(env);
	try {
		const [created] = await db.insert(gatewayWebhookEndpoints).values(values).returning({ id: gatewayWebhookEndpoints.id });
		return created ?? null;
	} finally { await client.end({ timeout: 1 }); }
}

export async function updateWebhookEndpoint(
	env: Env,
	endpointId: string,
	workspaceId: string,
	values: Partial<typeof gatewayWebhookEndpoints.$inferInsert>,
) {
	const { db, client } = createDatabase(env);
	try {
		const [updated] = await db.update(gatewayWebhookEndpoints).set(values).where(and(
			eq(gatewayWebhookEndpoints.id, endpointId),
			eq(gatewayWebhookEndpoints.workspaceId, workspaceId),
			ne(gatewayWebhookEndpoints.status, "deleted"),
		)).returning({ id: gatewayWebhookEndpoints.id });
		return updated ?? null;
	} finally { await client.end({ timeout: 1 }); }
}
