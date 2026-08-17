// Purpose: Persist async operation ownership and billing metadata.
// Why: Long-running jobs (video/batch) need team-scoped lookup across requests.
// How: Store operation records through typed Drizzle repositories with workspace+kind+internalId identity.

import * as asyncOperationRepository from "@/repositories/async-operations";

export type AsyncOperationKind = "video" | "batch" | "music";
const ASYNC_OPERATION_L1_TTL_MS = 1_000;

export type AsyncOperationRecord = {
	workspaceId: string;
	kind: AsyncOperationKind;
	internalId: string;
	requestId: string | null;
	sessionId: string | null;
	appId: string | null;
	provider: string | null;
	nativeId: string | null;
	model: string | null;
	status: string | null;
	meta: Record<string, unknown>;
	billedAt: string | null;
	nextReconcileAt: string | null;
	reconcileAttempts: number;
	reconcileLockedAt: string | null;
	reconcileLockedBy: string | null;
	lastReconcileError: string | null;
	createdAt: string | null;
	updatedAt: string | null;
};

export type PendingAsyncWebhookDelivery = {
	workspaceId: string;
	kind: "video" | "batch";
	internalId: string;
	deliveryKey: string;
	eventType: string;
	phase: string;
	progress: number | null;
	previousStatus: string | null;
	currentStatus: string | null;
};

type AsyncOperationRow = {
	workspace_id: string;
	kind: AsyncOperationKind;
	internal_id: string;
	request_id: string | null;
	session_id: string | null;
	app_id: string | null;
	provider: string | null;
	native_id: string | null;
	model: string | null;
	status: string | null;
	meta: Record<string, unknown> | null;
	billed_at: string | null;
	next_reconcile_at: string | null;
	reconcile_attempts: number | null;
	reconcile_locked_at: string | null;
	reconcile_locked_by: string | null;
	last_reconcile_error: string | null;
	created_at: string | null;
	updated_at: string | null;
};

type AsyncOperationL1Entry = {
	value: AsyncOperationRecord | null;
	expiresAtMs: number;
};

const asyncOperationL1 = new Map<string, AsyncOperationL1Entry>();
const asyncOperationInflight = new Map<string, Promise<AsyncOperationRecord | null>>();
const asyncOperationEpoch = new Map<string, number>();

function asyncOperationCacheKey(workspaceId: string, kind: AsyncOperationKind, internalId: string): string {
	return `${workspaceId}:${kind}:${internalId}`;
}

function readAsyncOperationL1(key: string): AsyncOperationRecord | null | undefined {
	const entry = asyncOperationL1.get(key);
	if (!entry) return undefined;
	if (entry.expiresAtMs <= Date.now()) {
		asyncOperationL1.delete(key);
		return undefined;
	}
	return entry.value;
}

function writeAsyncOperationL1(key: string, value: AsyncOperationRecord | null, ttlMs = ASYNC_OPERATION_L1_TTL_MS): void {
	if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
	asyncOperationL1.set(key, {
		value,
		expiresAtMs: Date.now() + ttlMs,
	});
}

function currentAsyncOperationEpoch(key: string): number {
	return asyncOperationEpoch.get(key) ?? 0;
}

function invalidateAsyncOperationCache(workspaceId: string, kind: AsyncOperationKind, internalId: string): void {
	const key = asyncOperationCacheKey(workspaceId, kind, internalId);
	asyncOperationL1.delete(key);
	asyncOperationInflight.delete(key);
	asyncOperationEpoch.set(key, currentAsyncOperationEpoch(key) + 1);
}

export function __resetAsyncOperationCachesForTests(): void {
	asyncOperationL1.clear();
	asyncOperationInflight.clear();
	asyncOperationEpoch.clear();
}

function normalizeText(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeUuid(value: unknown): string | null {
	const text = normalizeText(value);
	if (!text) return null;
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
		? text
		: null;
}

function normalizeMeta(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

function mapRow(row: AsyncOperationRow): AsyncOperationRecord {
	return {
		workspaceId: row.workspace_id,
		kind: row.kind,
		internalId: row.internal_id,
		requestId: row.request_id ?? null,
		sessionId: row.session_id ?? null,
		appId: row.app_id ?? null,
		provider: row.provider,
		nativeId: row.native_id,
		model: row.model,
		status: row.status,
		meta: normalizeMeta(row.meta),
		billedAt: row.billed_at,
		nextReconcileAt: row.next_reconcile_at,
		reconcileAttempts: typeof row.reconcile_attempts === "number" ? row.reconcile_attempts : 0,
		reconcileLockedAt: row.reconcile_locked_at,
		reconcileLockedBy: row.reconcile_locked_by,
		lastReconcileError: row.last_reconcile_error,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export async function upsertAsyncOperation(args: {
	workspaceId: string;
	kind: AsyncOperationKind;
	internalId: string;
	requestId?: string | null;
	sessionId?: string | null;
	appId?: string | null;
	provider?: string | null;
	nativeId?: string | null;
	model?: string | null;
	status?: string | null;
	meta?: Record<string, unknown> | null;
	nextReconcileAt?: string | null;
}): Promise<void> {
	const workspaceId = normalizeText(args.workspaceId);
	const internalId = normalizeText(args.internalId);
	if (!workspaceId || !internalId) return;

	const now = new Date().toISOString();
	const payload = {
		workspaceId,
		kind: args.kind,
		internalId,
		requestId: normalizeText(args.requestId) ?? null,
		sessionId: normalizeText(args.sessionId) ?? null,
		appId: normalizeUuid(args.appId) ?? null,
		provider: normalizeText(args.provider) ?? null,
		nativeId: normalizeText(args.nativeId) ?? null,
		model: normalizeText(args.model) ?? null,
		status: normalizeText(args.status) ?? null,
		meta: normalizeMeta(args.meta),
		updatedAt: now,
	} as Record<string, unknown>;
	if (Object.prototype.hasOwnProperty.call(args, "nextReconcileAt")) {
		payload.nextReconcileAt = normalizeText(args.nextReconcileAt) ?? null;
	}

	await asyncOperationRepository.upsertOperation(payload as Parameters<typeof asyncOperationRepository.upsertOperation>[0]);
	invalidateAsyncOperationCache(workspaceId, args.kind, internalId);
}

export async function listAsyncOperations(args: {
	kind: AsyncOperationKind;
	limit?: number;
	offset?: number;
	providers?: string[];
	statuses?: Array<string | null>;
	unbilledOnly?: boolean;
}): Promise<AsyncOperationRecord[]> {
	const limit = Number.isFinite(args.limit) ? Math.max(1, Math.min(500, Math.trunc(args.limit!))) : 100;
	const offset = Number.isFinite(args.offset) ? Math.max(0, Math.trunc(args.offset!)) : 0;
	const providers = args.providers?.map((value) => normalizeText(value)).filter((value): value is string => Boolean(value));
	const data = await asyncOperationRepository.listOperations({ kind: args.kind, limit, offset, providers, statuses: args.statuses, unbilledOnly: args.unbilledOnly });
	return (data ?? []).map((row) => mapRow(row as AsyncOperationRow));
}

async function callWebhookDeliveryRpc(name: string, args: {
	workspaceId: string;
	kind: AsyncOperationKind;
	internalId: string;
	deliveryKey: string;
	claimToken: string;
	staleAfterSeconds?: number;
}): Promise<boolean> {
	if (name === "claim_gateway_async_webhook_delivery") return asyncOperationRepository.claimWebhookDelivery({ ...args, staleAfterSeconds: args.staleAfterSeconds ?? 300 });
	if (name === "complete_gateway_async_webhook_delivery") return asyncOperationRepository.completeWebhookDelivery(args);
	return asyncOperationRepository.releaseWebhookDelivery(args);
}

export function claimAsyncWebhookDelivery(args: {
	workspaceId: string;
	kind: AsyncOperationKind;
	internalId: string;
	deliveryKey: string;
	claimToken: string;
	staleAfterSeconds?: number;
}): Promise<boolean> {
	return callWebhookDeliveryRpc("claim_gateway_async_webhook_delivery", args);
}

export function completeAsyncWebhookDelivery(args: {
	workspaceId: string;
	kind: AsyncOperationKind;
	internalId: string;
	deliveryKey: string;
	claimToken: string;
}): Promise<boolean> {
	return callWebhookDeliveryRpc("complete_gateway_async_webhook_delivery", args);
}

export function releaseAsyncWebhookDeliveryClaim(args: {
	workspaceId: string;
	kind: AsyncOperationKind;
	internalId: string;
	deliveryKey: string;
	claimToken: string;
}): Promise<boolean> {
	return callWebhookDeliveryRpc("release_gateway_async_webhook_delivery_claim", args);
}

export async function listPendingAsyncWebhookDeliveries(limit = 100): Promise<PendingAsyncWebhookDelivery[]> {
	const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.trunc(limit))) : 100;
	const data = await asyncOperationRepository.listPendingWebhookDeliveries(normalizedLimit);
	return (data ?? []).flatMap((row: any) => {
		if (row.kind !== "video" && row.kind !== "batch") return [];
		if (!normalizeText(row.event_type) || !normalizeText(row.phase)) return [];
		return [{
			workspaceId: String(row.workspace_id),
			kind: row.kind,
			internalId: String(row.internal_id),
			deliveryKey: String(row.delivery_key),
			eventType: String(row.event_type),
			phase: String(row.phase),
			progress: typeof row.progress === "number" ? row.progress : null,
			previousStatus: normalizeText(row.previous_status),
			currentStatus: normalizeText(row.current_status),
		}];
	});
}

export async function recordAsyncWebhookDeliveryResult(args: {
	workspaceId: string;
	kind: AsyncOperationKind;
	internalId: string;
	deliveryKey: string;
	attempt: Record<string, unknown>;
	retryState?: Record<string, unknown> | null;
	deliveredAt?: string | null;
	nextRetryAt?: string | null;
	progress?: number | null;
	telemetryPatch?: Record<string, unknown>;
}): Promise<void> {
	await asyncOperationRepository.recordWebhookResult({
		workspaceId: args.workspaceId, kind: args.kind, internalId: args.internalId, deliveryKey: args.deliveryKey,
		attempt: args.attempt, retryState: args.retryState ?? null, deliveredAt: args.deliveredAt ?? null,
		nextRetryAt: args.nextRetryAt ?? null, progress: args.progress ?? null, telemetryPatch: args.telemetryPatch ?? null,
	});
	invalidateAsyncOperationCache(args.workspaceId, args.kind, args.internalId);
}

export async function discardPendingAsyncWebhookDelivery(args: {
	workspaceId: string;
	kind: AsyncOperationKind;
	internalId: string;
	deliveryKey: string;
	reason: string;
}): Promise<void> {
	await asyncOperationRepository.updateWebhookDelivery({ ...args, status: "failed" });
}

export async function markPendingAsyncWebhookDeliveryDelivered(args: {
	workspaceId: string;
	kind: AsyncOperationKind;
	internalId: string;
	deliveryKey: string;
}): Promise<void> {
	await asyncOperationRepository.updateWebhookDelivery({ ...args, status: "delivered" });
}

export async function claimAsyncOperationsForReconciliation(args: {
	kind: AsyncOperationKind;
	limit?: number;
	statuses?: Array<string | null>;
	workerId?: string;
	leaseSeconds?: number;
	shardCount?: number;
	shardIndex?: number;
}): Promise<AsyncOperationRecord[]> {
	const limit = Number.isFinite(args.limit) ? Math.max(1, Math.min(2_000, Math.trunc(args.limit!))) : 100;
	const leaseSeconds = Number.isFinite(args.leaseSeconds)
		? Math.max(30, Math.min(3_600, Math.trunc(args.leaseSeconds!)))
		: 120;
	const shardCount = Number.isFinite(args.shardCount)
		? Math.max(1, Math.min(256, Math.trunc(args.shardCount!)))
		: 1;
	const shardIndex = Number.isFinite(args.shardIndex)
		? Math.max(0, Math.min(shardCount - 1, Math.trunc(args.shardIndex!)))
		: 0;
	const statuses = args.statuses
		?.map((value) => normalizeText(value) ?? "")
		.filter((value, index, values) => values.indexOf(value) === index);

	const data = await asyncOperationRepository.claimOperationsForReconciliation({
		kind: args.kind, limit, statuses: statuses && statuses.length > 0 ? statuses : null,
		workerId: normalizeText(args.workerId) ?? "gateway-reconciler", leaseSeconds, shardCount, shardIndex,
	});
	return (data ?? []).map((row) => mapRow(row as AsyncOperationRow));
}

export async function updateAsyncOperationReconciliation(args: {
	workspaceId: string;
	kind: AsyncOperationKind;
	internalId: string;
	nextReconcileAt?: string | null;
	lastError?: string | null;
	clearLease?: boolean;
}): Promise<void> {
	const workspaceId = normalizeText(args.workspaceId);
	const internalId = normalizeText(args.internalId);
	if (!workspaceId || !internalId) return;

	await asyncOperationRepository.updateReconciliation({
		workspaceId, kind: args.kind, internalId, lastError: normalizeText(args.lastError) ?? null,
		clearLease: args.clearLease !== false,
		...(Object.prototype.hasOwnProperty.call(args, "nextReconcileAt") ? { nextReconcileAt: normalizeText(args.nextReconcileAt) ?? null } : {}),
	});
	invalidateAsyncOperationCache(workspaceId, args.kind, internalId);
}

export async function listTeamAsyncOperations(args: {
	workspaceId: string;
	kind: AsyncOperationKind;
	limit?: number;
	statuses?: Array<string | null>;
}): Promise<AsyncOperationRecord[]> {
	const workspaceId = normalizeText(args.workspaceId);
	if (!workspaceId) return [];
	const limit = Number.isFinite(args.limit) ? Math.max(1, Math.min(500, Math.trunc(args.limit!))) : 100;

	const data = await asyncOperationRepository.listOperations({ workspaceId, kind: args.kind, limit, statuses: args.statuses, descending: true });
	return (data ?? []).map((row) => mapRow(row as AsyncOperationRow));
}

export async function getAsyncOperation(
	workspaceIdRaw: string,
	kind: AsyncOperationKind,
	internalIdRaw: string,
): Promise<AsyncOperationRecord | null> {
	const workspaceId = normalizeText(workspaceIdRaw);
	const internalId = normalizeText(internalIdRaw);
	if (!workspaceId || !internalId) return null;
	const cacheKey = asyncOperationCacheKey(workspaceId, kind, internalId);
	const cached = readAsyncOperationL1(cacheKey);
	if (cached !== undefined) return cached;

	const inflight = asyncOperationInflight.get(cacheKey);
	if (inflight) return inflight;

	const epoch = currentAsyncOperationEpoch(cacheKey);
	const loader = (async (): Promise<AsyncOperationRecord | null> => {
		const data = await asyncOperationRepository.findOperation(workspaceId, kind, internalId);
		const record = data ? mapRow(data as AsyncOperationRow) : null;
		if (currentAsyncOperationEpoch(cacheKey) === epoch) {
			writeAsyncOperationL1(cacheKey, record);
		}
		return record;
	})();

	asyncOperationInflight.set(cacheKey, loader);
	try {
		return await loader;
	} finally {
		if (asyncOperationInflight.get(cacheKey) === loader) {
			asyncOperationInflight.delete(cacheKey);
		}
	}
}

export async function findAsyncOperationByNativeId(
	kind: AsyncOperationKind,
	providerRaw: string,
	nativeIdRaw: string,
): Promise<AsyncOperationRecord | null> {
	const provider = normalizeText(providerRaw);
	const nativeId = normalizeText(nativeIdRaw);
	if (!provider || !nativeId) return null;

	const data = await asyncOperationRepository.findOperationByNativeId(kind, provider, nativeId);
	const rows = Array.isArray(data) ? data : [];
	if (rows.length > 1) {
		console.error("async_operation_native_id_ambiguous", {
			kind,
			provider,
			nativeId,
			matchCount: rows.length,
		});
		return null;
	}
	const row = rows[0] ?? null;
	if (!row) return null;
	return mapRow(row as AsyncOperationRow);
}

export async function isAsyncOperationBilled(
	workspaceIdRaw: string,
	kind: AsyncOperationKind,
	internalIdRaw: string,
): Promise<boolean> {
	const workspaceId = normalizeText(workspaceIdRaw);
	const internalId = normalizeText(internalIdRaw);
	if (!workspaceId || !internalId) return false;

	const data = await asyncOperationRepository.findOperation(workspaceId, kind, internalId);
	return Boolean((data as { billed_at?: string | null } | null)?.billed_at);
}

export async function markAsyncOperationBilled(
	workspaceIdRaw: string,
	kind: AsyncOperationKind,
	internalIdRaw: string,
): Promise<boolean> {
	const workspaceId = normalizeText(workspaceIdRaw);
	const internalId = normalizeText(internalIdRaw);
	if (!workspaceId || !internalId) return false;

	const changed = await asyncOperationRepository.markOperationBilled(workspaceId, kind, internalId);
	if (changed) invalidateAsyncOperationCache(workspaceId, kind, internalId);
	return changed;
}

export async function setAsyncOperationStatus(args: {
	workspaceId: string;
	kind: AsyncOperationKind;
	internalId: string;
	status: string;
	metaPatch?: Record<string, unknown>;
	nextReconcileAt?: string | null;
}): Promise<void> {
	const workspaceId = normalizeText(args.workspaceId);
	const internalId = normalizeText(args.internalId);
	const status = normalizeText(args.status);
	if (!workspaceId || !internalId || !status) return;

	const updateNextReconcile = Object.prototype.hasOwnProperty.call(args, "nextReconcileAt");
	await asyncOperationRepository.setOperationStatus({ workspaceId, kind: args.kind, internalId, status, metaPatch: normalizeMeta(args.metaPatch), updateNextReconcile, nextReconcileAt: updateNextReconcile ? normalizeText(args.nextReconcileAt) : null });
	invalidateAsyncOperationCache(workspaceId, args.kind, internalId);
}

export async function patchAsyncOperationMeta(args: {
	workspaceId: string;
	kind: AsyncOperationKind;
	internalId: string;
	metaPatch: Record<string, unknown>;
}): Promise<void> {
	const workspaceId = normalizeText(args.workspaceId);
	const internalId = normalizeText(args.internalId);
	if (!workspaceId || !internalId) return;
	if (!args.metaPatch || typeof args.metaPatch !== "object" || Array.isArray(args.metaPatch)) return;

	await asyncOperationRepository.setOperationStatus({ workspaceId, kind: args.kind, internalId, status: null, metaPatch: normalizeMeta(args.metaPatch), updateNextReconcile: false, nextReconcileAt: null });
	invalidateAsyncOperationCache(workspaceId, args.kind, internalId);
}

export async function patchAsyncOperationIdentity(args: {
	workspaceId: string;
	kind: AsyncOperationKind;
	internalId: string;
	requestId?: string | null;
	sessionId?: string | null;
	appId?: string | null;
	provider?: string | null;
	nativeId?: string | null;
	model?: string | null;
}): Promise<void> {
	const workspaceId = normalizeText(args.workspaceId);
	const internalId = normalizeText(args.internalId);
	if (!workspaceId || !internalId) return;
	const patch: Record<string, unknown> = {};
	const requestId = normalizeText(args.requestId);
	const sessionId = normalizeText(args.sessionId);
	const appId = normalizeUuid(args.appId);
	const provider = normalizeText(args.provider);
	const nativeId = normalizeText(args.nativeId);
	const model = normalizeText(args.model);
	if (requestId) patch.requestId = requestId;
	if (sessionId) patch.sessionId = sessionId;
	if (appId) patch.appId = appId;
	if (provider) patch.provider = provider;
	if (nativeId) patch.nativeId = nativeId;
	if (model) patch.model = model;
	if (Object.keys(patch).length === 0) return;
	await asyncOperationRepository.patchOperationIdentity(workspaceId, args.kind, internalId, patch);
	invalidateAsyncOperationCache(workspaceId, args.kind, internalId);
}
