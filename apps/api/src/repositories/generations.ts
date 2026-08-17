import { gatewayIoLogs, gatewayRequests } from "@phaseo/db/schema";
import { and, eq } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function findGeneration(workspaceId: string, requestId: string) {
	return withDatabase(async (db) => {
		const [row] = await db.select().from(gatewayRequests)
			.where(and(eq(gatewayRequests.workspaceId, workspaceId), eq(gatewayRequests.requestId, requestId))).limit(1);
		return row ?? null;
	});
}

export async function findGenerationIoLog(workspaceId: string, requestId: string) {
	return withDatabase(async (db) => {
		const [row] = await db.select({
			io_log_status: gatewayIoLogs.ioLogStatus,
			io_log_storage_provider: gatewayIoLogs.ioLogStorageProvider,
			io_log_bucket: gatewayIoLogs.ioLogBucket,
			io_log_object_key: gatewayIoLogs.ioLogObjectKey,
			io_log_bytes: gatewayIoLogs.ioLogBytes,
			io_log_sha256: gatewayIoLogs.ioLogSha256,
			io_log_content_type: gatewayIoLogs.ioLogContentType,
			io_log_retention_until: gatewayIoLogs.ioLogRetentionUntil,
			io_log_error: gatewayIoLogs.ioLogError,
		}).from(gatewayIoLogs).where(and(eq(gatewayIoLogs.workspaceId, workspaceId), eq(gatewayIoLogs.requestId, requestId))).limit(1);
		return row ?? null;
	});
}

export async function upsertGenerationIoLog(values: typeof gatewayIoLogs.$inferInsert): Promise<void> {
	await withDatabase(async (db) => {
		await db.insert(gatewayIoLogs).values(values).onConflictDoUpdate({
			target: [gatewayIoLogs.workspaceId, gatewayIoLogs.requestId],
			set: {
				ioLogStatus: values.ioLogStatus,
				ioLogStorageProvider: values.ioLogStorageProvider,
				ioLogBucket: values.ioLogBucket,
				ioLogObjectKey: values.ioLogObjectKey,
				ioLogBytes: values.ioLogBytes,
				ioLogSha256: values.ioLogSha256,
				ioLogContentType: values.ioLogContentType,
				ioLogRetentionUntil: values.ioLogRetentionUntil,
				ioLogError: values.ioLogError,
			},
		});
	});
}
