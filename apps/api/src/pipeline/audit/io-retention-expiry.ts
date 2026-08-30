import { getBindings, getSupabaseAdmin } from "@/runtime/env";

const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 5_000;

type ExpiredIoLogRow = {
	id: string;
	io_log_object_key: string | null;
};

export type GatewayIoRetentionExpirySummary = {
	selected: number;
	deleted: number;
	failed: number;
};

function normalizedLimit(value: number | undefined): number {
	if (!Number.isFinite(value)) return DEFAULT_LIMIT;
	return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(value as number)));
}

export async function pruneExpiredGatewayIoLogs(options?: {
	asOf?: Date;
	limit?: number;
}): Promise<GatewayIoRetentionExpirySummary> {
	const bucket = getBindings().GATEWAY_IO_LOGS_BUCKET;
	if (!bucket) throw new Error("gateway_io_retention_bucket_missing");

	const supabase = getSupabaseAdmin();
	const { data, error } = await supabase
		.from("gateway_io_logs")
		.select("id,io_log_object_key")
		.eq("io_log_status", "stored")
		.not("io_log_object_key", "is", null)
		.not("io_log_retention_until", "is", null)
		.lt("io_log_retention_until", (options?.asOf ?? new Date()).toISOString())
		.order("io_log_retention_until", { ascending: true })
		.limit(normalizedLimit(options?.limit));
	if (error) throw new Error(`gateway_io_retention_expiry_select_failed:${error.message ?? "unknown"}`);

	const rows = (data ?? []) as ExpiredIoLogRow[];
	const summary: GatewayIoRetentionExpirySummary = { selected: rows.length, deleted: 0, failed: 0 };
	for (const row of rows) {
		if (!row.io_log_object_key) continue;
		try {
			await bucket.delete(row.io_log_object_key);
			const { error: deleteError } = await supabase.from("gateway_io_logs").delete().eq("id", row.id);
			if (deleteError) throw new Error(deleteError.message || "metadata_delete_failed");
			summary.deleted += 1;
		} catch (error) {
			summary.failed += 1;
			console.warn("gateway_io_retention_expiry_delete_failed", {
				logId: row.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return summary;
}
