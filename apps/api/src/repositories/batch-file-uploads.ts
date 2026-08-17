import { gatewayBatchFileUploads, wallets } from "@phaseo/db/schema";
import { and, eq, sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_HOURLY_UPLOADS = 20;
const MAX_DAILY_BYTES = 100 * 1024 * 1024;

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function claimUpload(args: { workspaceId: string; uploadId: string; bytes: number }) {
	if (!args.workspaceId || !args.uploadId.trim() || !Number.isSafeInteger(args.bytes) || args.bytes <= 0) {
		throw new Error("invalid_batch_file_upload_claim");
	}
	if (args.bytes > MAX_FILE_BYTES) return { ok: false, reason: "batch_file_too_large" };
	return withDatabase((db) => db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'batch-file:' + args.workspaceId}, 0))`);
		const [wallet] = await tx.select({ balance: wallets.balanceNanos, reserved: wallets.reservedNanos })
			.from(wallets).where(eq(wallets.workspaceId, args.workspaceId)).limit(1);
		if (!wallet || wallet.balance - (wallet.reserved ?? 0) <= 0) return { ok: false, reason: "insufficient_funds" };

		const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(gatewayBatchFileUploads).where(and(
			eq(gatewayBatchFileUploads.workspaceId, args.workspaceId), sql`${gatewayBatchFileUploads.createdAt} >= now() - interval '1 hour'`,
		));
		if ((count ?? 0) >= MAX_HOURLY_UPLOADS) return { ok: false, reason: "batch_file_hourly_quota_exceeded" };

		const [{ bytes }] = await tx.select({ bytes: sql<number>`coalesce(sum(${gatewayBatchFileUploads.bytes}), 0)::bigint` })
			.from(gatewayBatchFileUploads).where(and(
				eq(gatewayBatchFileUploads.workspaceId, args.workspaceId), sql`${gatewayBatchFileUploads.createdAt} >= now() - interval '24 hours'`,
			));
		if (Number(bytes ?? 0) + args.bytes > MAX_DAILY_BYTES) return { ok: false, reason: "batch_file_daily_bytes_exceeded" };

		const inserted = await tx.insert(gatewayBatchFileUploads).values({
			workspaceId: args.workspaceId, uploadId: args.uploadId, bytes: args.bytes, status: "claimed",
		}).onConflictDoNothing().returning({ uploadId: gatewayBatchFileUploads.uploadId });
		return inserted.length ? { ok: true, reason: null } : { ok: false, reason: "batch_file_upload_already_claimed" };
	}));
}

export async function finishUpload(args: {
	workspaceId: string; uploadId: string; status: "completed" | "failed"; providerFileId?: string | null;
}): Promise<void> {
	await withDatabase(async (db) => { await db.update(gatewayBatchFileUploads).set({
		status: args.status, providerFileId: args.providerFileId?.trim() || null, updatedAt: new Date().toISOString(),
	}).where(and(
		eq(gatewayBatchFileUploads.workspaceId, args.workspaceId),
		eq(gatewayBatchFileUploads.uploadId, args.uploadId),
	)); });
}
