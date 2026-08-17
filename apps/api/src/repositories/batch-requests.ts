import { gatewayBatchRequests } from "@phaseo/db/schema";
import { and, asc, eq } from "@phaseo/db/query";

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
				provider: gatewayBatchRequests.provider,
				nativeBatchId: gatewayBatchRequests.nativeBatchId,
				requestIndex: gatewayBatchRequests.requestIndex,
				method: gatewayBatchRequests.method,
				endpoint: gatewayBatchRequests.endpoint,
				model: gatewayBatchRequests.model,
				status: gatewayBatchRequests.status,
				requestBodyHash: gatewayBatchRequests.requestBodyHash,
				responseStatus: gatewayBatchRequests.responseStatus,
				responseBody: gatewayBatchRequests.responseBody,
				errorBody: gatewayBatchRequests.errorBody,
				usage: gatewayBatchRequests.usage,
				costNanos: gatewayBatchRequests.costNanos,
				costUsd: gatewayBatchRequests.costUsd,
				meta: gatewayBatchRequests.meta,
				completedAt: gatewayBatchRequests.completedAt,
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
