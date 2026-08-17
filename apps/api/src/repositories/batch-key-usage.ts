import { gatewayBatchKeyUsageRecords, gatewayWalletReservations, keys } from "@phaseo/db/schema";
import { and, eq, sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

export type BatchKeyUsageRow = {
	custom_id: string;
	model: string;
	endpoint: string;
	cost_nanos: number;
	usage: Record<string, unknown>;
};

export async function recordBatchKeyUsage(args: {
	workspaceId: string;
	keyId: string;
	batchId: string;
	provider: string;
	rows: BatchKeyUsageRow[];
}): Promise<number> {
	if (!args.workspaceId || !args.keyId || !args.batchId.trim() || args.rows.length === 0) {
		throw new Error("invalid_batch_key_usage_identity");
	}
	const { db, client } = createDatabase(getBindings());
	try {
		return await db.transaction(async (tx) => {
			await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'batch-key-usage:' + args.workspaceId + ':' + args.batchId}, 0))`);
			const [ownedKey] = await tx.select({ id: keys.id }).from(keys).where(and(
				eq(keys.id, args.keyId),
				eq(keys.workspaceId, args.workspaceId),
			)).limit(1);
			if (!ownedKey) throw new Error("batch_key_not_owned_by_workspace");

			await tx.execute(sql`
				delete from gateway_requests request
				where request.workspace_id = ${args.workspaceId}::uuid
					and request.key_id = ${args.keyId}::uuid
					and request.request_id like 'batch_hold_usage:%'
					and exists (
						select 1 from gateway_wallet_reservations reservation
						where reservation.workspace_id = ${args.workspaceId}::uuid
							and reservation.key_id = ${args.keyId}::uuid
							and reservation.capture_ref_id = ${args.batchId}
							and reservation.status = 'captured'
							and request.request_id like 'batch_hold_usage:' || reservation.reservation_id || ':%'
					)
			`);

			const claimed = await tx.insert(gatewayBatchKeyUsageRecords).values(args.rows.map((row, index) => ({
				workspaceId: args.workspaceId,
				batchId: args.batchId,
				customId: row.custom_id.trim() || String(index + 1),
				keyId: args.keyId,
				provider: args.provider.trim() || null,
				endpoint: row.endpoint.trim() || "batch",
				model: row.model.trim() || "batch/unknown",
				costNanos: Math.max(0, Math.round(row.cost_nanos || 0)),
				usage: row.usage && typeof row.usage === "object" ? row.usage : {},
			}))).onConflictDoNothing({
				target: [gatewayBatchKeyUsageRecords.workspaceId, gatewayBatchKeyUsageRecords.batchId, gatewayBatchKeyUsageRecords.customId],
			}).returning({
				custom_id: gatewayBatchKeyUsageRecords.customId,
				provider: gatewayBatchKeyUsageRecords.provider,
				endpoint: gatewayBatchKeyUsageRecords.endpoint,
				model: gatewayBatchKeyUsageRecords.model,
				cost_nanos: gatewayBatchKeyUsageRecords.costNanos,
				usage: gatewayBatchKeyUsageRecords.usage,
			});

			if (claimed.length > 0) {
				await tx.execute(sql`
					insert into gateway_requests (
						workspace_id,request_id,endpoint,model_id,provider,status_code,success,usage,cost_nanos,currency,key_id
					)
					select ${args.workspaceId}::uuid,'batch_usage:' || ${args.batchId} || ':' || row.custom_id,
						row.endpoint,row.model,row.provider,200,true,row.usage,row.cost_nanos,'USD',${args.keyId}::uuid
					from jsonb_to_recordset(${JSON.stringify(claimed)}::jsonb) as row(
						custom_id text,provider text,endpoint text,model text,cost_nanos bigint,usage jsonb
					)
				`);
			}

			const now = new Date().toISOString();
			await tx.update(gatewayWalletReservations).set({
				keyUsageRecordedAt: sql`coalesce(${gatewayWalletReservations.keyUsageRecordedAt}, ${now}::timestamptz)`,
				updatedAt: now,
			}).where(and(
				eq(gatewayWalletReservations.workspaceId, args.workspaceId),
				eq(gatewayWalletReservations.keyId, args.keyId),
				eq(gatewayWalletReservations.captureRefId, args.batchId),
				eq(gatewayWalletReservations.status, "captured"),
			));
			return claimed.length;
		});
	} finally {
		await client.end({ timeout: 1 });
	}
}
