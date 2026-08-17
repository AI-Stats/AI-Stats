import { gatewayBatchRequests } from "@phaseo/db/schema";
import { and, asc, eq, sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try {
		return await operation(db);
	} finally {
		await client.end({ timeout: 1 });
	}
}

export type BatchRequestInsert = typeof gatewayBatchRequests.$inferInsert;
export type BatchRequestRecord = typeof gatewayBatchRequests.$inferSelect;

export async function upsertBatchRequestRows(rows: BatchRequestInsert[]): Promise<void> {
	if (rows.length === 0) return;
	await withDatabase(async (db) => {
		await db.insert(gatewayBatchRequests).values(rows).onConflictDoUpdate({
			target: [
				gatewayBatchRequests.workspaceId,
				gatewayBatchRequests.batchId,
				gatewayBatchRequests.customId,
			],
			set: {
				provider: sql`excluded.provider`,
				nativeBatchId: sql`excluded.native_batch_id`,
				requestIndex: sql`excluded.request_index`,
				method: sql`excluded.method`,
				endpoint: sql`excluded.endpoint`,
				model: sql`excluded.model`,
				status: sql`excluded.status`,
				requestBodyHash: sql`excluded.request_body_hash`,
				responseStatus: sql`excluded.response_status`,
				responseBody: sql`excluded.response_body`,
				errorBody: sql`excluded.error_body`,
				usage: sql`excluded.usage`,
				costNanos: sql`excluded.cost_nanos`,
				costUsd: sql`excluded.cost_usd`,
				meta: sql`excluded.meta`,
				completedAt: sql`excluded.completed_at`,
				updatedAt: new Date().toISOString(),
			},
		});
	});
}

export async function findBatchRequestRows(args: {
	workspaceId: string;
	batchId: string;
	limit: number;
	offset: number;
	status?: string | null;
}): Promise<BatchRequestRecord[]> {
	return withDatabase((db) => {
		const filters = [
			eq(gatewayBatchRequests.workspaceId, args.workspaceId),
			eq(gatewayBatchRequests.batchId, args.batchId),
		];
		if (args.status) filters.push(eq(gatewayBatchRequests.status, args.status));
		return db.select().from(gatewayBatchRequests)
			.where(and(...filters))
			.orderBy(asc(gatewayBatchRequests.requestIndex))
			.limit(args.limit)
			.offset(args.offset);
	});
}
