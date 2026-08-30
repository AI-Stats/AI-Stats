import { getBindings, getCache, getSupabaseAdmin } from "@/runtime/env";

const DEFAULT_JOB_LIMIT = 5;
const DEFAULT_LEASE_SECONDS = 300;
const MAX_R2_OBJECTS_PER_PREFIX = 10_000;
const MAX_KV_LIST_PAGES = 100;
const KV_DELETE_CONCURRENCY = 25;

type AccountDeletionJob = {
	id: string;
	user_id: string | null;
	workspace_ids: string[] | null;
	key_ids: string[] | null;
	key_kids: string[] | null;
	deadline_at: string;
	r2_objects_deleted: number | null;
	kv_keys_deleted: number | null;
	kv_scan_cursor: string | null;
	attempts: number;
};

type PurgeProgress = {
	r2ObjectsDeleted: number;
	kvKeysDeleted: number;
	kvScanComplete: boolean;
	kvScanCursor: string | null;
};

export type AccountDeletionPurgeSummary = {
	claimed: number;
	completed: number;
	failed: number;
	deferred: number;
	deadlineMissed: number;
	r2ObjectsDeleted: number;
	kvKeysDeleted: number;
};

function boundedInt(value: number | undefined, fallback: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.max(min, Math.min(max, Math.floor(value as number)));
}

function errorMessage(error: unknown): string {
	return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
}

async function deleteConcurrently(keys: string[], deleteKey: (key: string) => Promise<void>): Promise<void> {
	for (let offset = 0; offset < keys.length; offset += KV_DELETE_CONCURRENCY) {
		await Promise.all(keys.slice(offset, offset + KV_DELETE_CONCURRENCY).map(deleteKey));
	}
}

export async function purgeR2Prefix(
	bucket: R2Bucket,
	prefix: string,
	maxObjects = MAX_R2_OBJECTS_PER_PREFIX,
): Promise<{ complete: boolean; deleted: number }> {
	let deleted = 0;
	while (deleted < maxObjects) {
		const listed = await bucket.list({ prefix, limit: Math.min(1000, maxObjects - deleted) });
		const keys = listed.objects.map((object) => object.key);
		if (keys.length === 0) return { complete: true, deleted };
		await bucket.delete(keys);
		deleted += keys.length;
		if (!listed.truncated) return { complete: true, deleted };
	}
	return { complete: false, deleted };
}

function containsDeletionIdentifier(
	key: string,
	workspaceIds: readonly string[],
	keyIds: readonly string[],
	keyKids: readonly string[],
): boolean {
	return [...workspaceIds, ...keyIds, ...keyKids].some((identifier) => identifier && key.includes(identifier));
}

export async function purgeKvAccountData(args: {
	cache: KVNamespace;
	workspaceIds: readonly string[];
	keyIds: readonly string[];
	keyKids: readonly string[];
	cursor?: string | null;
}): Promise<{ complete: boolean; deleted: number; cursor: string | null }> {
	let cursor = args.cursor ?? undefined;
	let deleted = 0;
	for (let page = 0; page < MAX_KV_LIST_PAGES; page += 1) {
		const result = await args.cache.list({ cursor, limit: 1000 });
		const matching = result.keys
			.map((entry) => entry.name)
			.filter((key) => containsDeletionIdentifier(key, args.workspaceIds, args.keyIds, args.keyKids));
		await deleteConcurrently(matching, (key) => args.cache.delete(key));
		deleted += matching.length;
		if (result.list_complete) return { complete: true, deleted, cursor: null };
		cursor = "cursor" in result ? result.cursor : undefined;
		if (!cursor) return { complete: false, deleted, cursor: null };
	}
	return { complete: false, deleted, cursor: cursor ?? null };
}

async function assertAuthUserDeleted(userId: string | null): Promise<void> {
	if (!userId) return;
	const { data } = await getSupabaseAdmin().auth.admin.getUserById(userId);
	if (data?.user) throw new Error("auth_user_still_exists");
}

async function purgeJob(job: AccountDeletionJob): Promise<PurgeProgress> {
	await assertAuthUserDeleted(job.user_id);
	const bindings = getBindings();
	const workspaceIds = [...new Set(job.workspace_ids ?? [])].filter(Boolean);
	const keyIds = [...new Set(job.key_ids ?? [])].filter(Boolean);
	const keyKids = [...new Set(job.key_kids ?? [])].filter(Boolean);
	let r2ObjectsDeleted = 0;

	if (workspaceIds.length > 0 && (!bindings.GATEWAY_IO_LOGS_BUCKET || !bindings.DATA_CONTRIBUTIONS_BUCKET)) {
		throw new Error("account_deletion_r2_binding_missing");
	}

	for (const workspaceId of workspaceIds) {
		const ioResult = await purgeR2Prefix(
			bindings.GATEWAY_IO_LOGS_BUCKET as R2Bucket,
			`workspaces/${workspaceId}/`,
		);
		r2ObjectsDeleted += ioResult.deleted;
		if (!ioResult.complete) throw new Error(`account_deletion_io_purge_incomplete:${workspaceId}`);

		const contributionResult = await purgeR2Prefix(
			bindings.DATA_CONTRIBUTIONS_BUCKET as R2Bucket,
			`contributions/${workspaceId}/`,
		);
		r2ObjectsDeleted += contributionResult.deleted;
		if (!contributionResult.complete) throw new Error(`account_deletion_contribution_purge_incomplete:${workspaceId}`);
	}

	const kvResult = await purgeKvAccountData({
		cache: getCache(),
		workspaceIds,
		keyIds,
		keyKids,
		cursor: job.kv_scan_cursor,
	});

	return {
		r2ObjectsDeleted,
		kvKeysDeleted: kvResult.deleted,
		kvScanComplete: kvResult.complete,
		kvScanCursor: kvResult.cursor,
	};
}

function retryAt(now: Date, attempts: number): string {
	const normalizedAttempts = Number.isFinite(attempts) ? Math.max(1, Math.floor(attempts)) : 1;
	const seconds = Math.min(3_600, 30 * (2 ** Math.min(normalizedAttempts - 1, 7)));
	return new Date(now.getTime() + seconds * 1_000).toISOString();
}

export async function runAccountDeletionPurgeJob(options?: {
	limit?: number;
	leaseSeconds?: number;
	now?: Date;
}): Promise<AccountDeletionPurgeSummary> {
	const limit = boundedInt(options?.limit, DEFAULT_JOB_LIMIT, 1, 25);
	const leaseSeconds = boundedInt(options?.leaseSeconds, DEFAULT_LEASE_SECONDS, 30, 900);
	const now = options?.now ?? new Date();
	const supabase = getSupabaseAdmin();
	const { data, error } = await supabase.rpc("claim_account_deletion_jobs", {
		p_limit: limit,
		p_lease_seconds: leaseSeconds,
	});
	if (error) throw new Error(error.message || "account_deletion_claim_failed");

	const jobs = (data ?? []) as AccountDeletionJob[];
	const summary: AccountDeletionPurgeSummary = {
		claimed: jobs.length,
		completed: 0,
		failed: 0,
		deferred: 0,
		deadlineMissed: 0,
		r2ObjectsDeleted: 0,
		kvKeysDeleted: 0,
	};

	for (const job of jobs) {
		let progress: PurgeProgress = {
			r2ObjectsDeleted: 0,
			kvKeysDeleted: 0,
			kvScanComplete: false,
			kvScanCursor: job.kv_scan_cursor,
		};
		try {
			progress = await purgeJob(job);
			if (!progress.kvScanComplete) {
				const { error: updateError } = await supabase
					.from("account_deletion_jobs")
					.update({
						status: "pending",
						lease_expires_at: null,
						last_error: null,
						next_attempt_at: now.toISOString(),
						kv_scan_cursor: progress.kvScanCursor,
						updated_at: now.toISOString(),
						r2_objects_deleted: Number(job.r2_objects_deleted ?? 0) + progress.r2ObjectsDeleted,
						kv_keys_deleted: Number(job.kv_keys_deleted ?? 0) + progress.kvKeysDeleted,
					})
					.eq("id", job.id);
				if (updateError) throw new Error(updateError.message || "account_deletion_progress_update_failed");
				summary.deferred += 1;
				summary.r2ObjectsDeleted += progress.r2ObjectsDeleted;
				summary.kvKeysDeleted += progress.kvKeysDeleted;
				continue;
			}
			const { error: updateError } = await supabase
				.from("account_deletion_jobs")
				.update({
					user_id: null,
					workspace_ids: [],
					key_ids: [],
					key_kids: [],
					status: "completed",
					lease_expires_at: null,
					kv_scan_cursor: null,
					next_attempt_at: now.toISOString(),
					last_error: null,
					completed_at: now.toISOString(),
					updated_at: now.toISOString(),
					r2_objects_deleted: Number(job.r2_objects_deleted ?? 0) + progress.r2ObjectsDeleted,
					kv_keys_deleted: Number(job.kv_keys_deleted ?? 0) + progress.kvKeysDeleted,
				})
				.eq("id", job.id);
			if (updateError) throw new Error(updateError.message || "account_deletion_complete_update_failed");
			summary.completed += 1;
			summary.r2ObjectsDeleted += progress.r2ObjectsDeleted;
			summary.kvKeysDeleted += progress.kvKeysDeleted;
		} catch (error) {
			const missed = Date.parse(job.deadline_at) <= now.getTime();
			const { error: updateError } = await supabase
				.from("account_deletion_jobs")
				.update({
					status: "failed",
					lease_expires_at: null,
					next_attempt_at: retryAt(now, job.attempts),
					last_error: errorMessage(error),
					updated_at: now.toISOString(),
					r2_objects_deleted: Number(job.r2_objects_deleted ?? 0) + progress.r2ObjectsDeleted,
					kv_keys_deleted: Number(job.kv_keys_deleted ?? 0) + progress.kvKeysDeleted,
				})
				.eq("id", job.id);
			if (updateError) console.error("account_deletion_failure_update_failed", { jobId: job.id, error: updateError.message });
			console.error(missed ? "account_deletion_deadline_missed" : "account_deletion_purge_failed", {
				jobId: job.id,
				error: errorMessage(error),
			});
			summary.failed += 1;
			if (missed) summary.deadlineMissed += 1;
		}
	}

	return summary;
}
