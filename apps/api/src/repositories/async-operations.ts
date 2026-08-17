import { gatewayAsyncOperations, gatewayAsyncWebhookDeliveries } from "@phaseo/db/schema";
import { and, asc, desc, eq, inArray, isNull, lte, ne, or, sql, type SQL } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

const operationSelection = {
	workspace_id: gatewayAsyncOperations.workspaceId, kind: gatewayAsyncOperations.kind,
	internal_id: gatewayAsyncOperations.internalId, request_id: gatewayAsyncOperations.requestId,
	session_id: gatewayAsyncOperations.sessionId, app_id: gatewayAsyncOperations.appId,
	provider: gatewayAsyncOperations.provider, native_id: gatewayAsyncOperations.nativeId,
	model: gatewayAsyncOperations.model, status: gatewayAsyncOperations.status, meta: gatewayAsyncOperations.meta,
	billed_at: gatewayAsyncOperations.billedAt, next_reconcile_at: gatewayAsyncOperations.nextReconcileAt,
	reconcile_attempts: gatewayAsyncOperations.reconcileAttempts, reconcile_locked_at: gatewayAsyncOperations.reconcileLockedAt,
	reconcile_locked_by: gatewayAsyncOperations.reconcileLockedBy, last_reconcile_error: gatewayAsyncOperations.lastReconcileError,
	created_at: gatewayAsyncOperations.createdAt, updated_at: gatewayAsyncOperations.updatedAt,
};

export function reconciliationStatusPredicate(statuses: string[] | null) {
	return statuses
		? inArray(sql.raw("coalesce(status, '')"), statuses)
		: sql`true`;
}

export type OperationRow = typeof operationSelection extends infer T ? { [K in keyof T]: T[K] extends { _: { data: infer D } } ? D : unknown } : never;

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function upsertOperation(values: typeof gatewayAsyncOperations.$inferInsert): Promise<void> {
	await withDatabase(async (db) => { await db.insert(gatewayAsyncOperations).values(values).onConflictDoUpdate({
		target: [gatewayAsyncOperations.workspaceId, gatewayAsyncOperations.kind, gatewayAsyncOperations.internalId],
		set: {
			requestId: values.requestId, sessionId: values.sessionId, appId: values.appId, provider: values.provider,
			nativeId: values.nativeId, model: values.model, status: values.status, meta: values.meta,
			...(Object.prototype.hasOwnProperty.call(values, "nextReconcileAt") ? { nextReconcileAt: values.nextReconcileAt } : {}),
			updatedAt: values.updatedAt,
		},
	}); });
}

function statusCondition(statuses?: Array<string | null>): SQL | undefined {
	if (!statuses?.length) return undefined;
	const includeNull = statuses.some((value) => value == null);
	const values = statuses.filter((value): value is string => Boolean(value));
	if (includeNull && values.length) return or(isNull(gatewayAsyncOperations.status), inArray(gatewayAsyncOperations.status, values));
	if (includeNull) return isNull(gatewayAsyncOperations.status);
	return values.length ? inArray(gatewayAsyncOperations.status, values) : undefined;
}

export async function listOperations(args: { workspaceId?: string; kind: string; limit: number; offset?: number; providers?: string[]; statuses?: Array<string | null>; unbilledOnly?: boolean; descending?: boolean }) {
	return withDatabase((db) => {
		const conditions: SQL[] = [eq(gatewayAsyncOperations.kind, args.kind)];
		if (args.workspaceId) conditions.push(eq(gatewayAsyncOperations.workspaceId, args.workspaceId));
		if (args.providers?.length) conditions.push(inArray(gatewayAsyncOperations.provider, args.providers));
		if (args.unbilledOnly) conditions.push(isNull(gatewayAsyncOperations.billedAt));
		const statuses = statusCondition(args.statuses); if (statuses) conditions.push(statuses);
		return db.select(operationSelection).from(gatewayAsyncOperations).where(and(...conditions))
			.orderBy(args.descending ? desc(gatewayAsyncOperations.updatedAt) : asc(gatewayAsyncOperations.updatedAt))
			.limit(args.limit).offset(args.offset ?? 0);
	});
}

type DeliveryIdentity = { workspaceId: string; kind: string; internalId: string; deliveryKey: string; claimToken: string };
const deliveryWhere = (args: Omit<DeliveryIdentity, "claimToken">) => and(
	eq(gatewayAsyncWebhookDeliveries.workspaceId, args.workspaceId), eq(gatewayAsyncWebhookDeliveries.kind, args.kind),
	eq(gatewayAsyncWebhookDeliveries.internalId, args.internalId), eq(gatewayAsyncWebhookDeliveries.deliveryKey, args.deliveryKey),
);

export async function claimWebhookDelivery(args: DeliveryIdentity & { staleAfterSeconds: number }): Promise<boolean> {
	return withDatabase((db) => db.transaction(async (tx) => {
		const now = new Date().toISOString();
		await tx.insert(gatewayAsyncWebhookDeliveries).values({
			workspaceId: args.workspaceId, kind: args.kind, internalId: args.internalId, deliveryKey: args.deliveryKey,
			status: "claimed", claimToken: args.claimToken, claimedAt: now, updatedAt: now,
		}).onConflictDoNothing();
		const [row] = await tx.select().from(gatewayAsyncWebhookDeliveries).where(deliveryWhere(args)).limit(1).for("update");
		if (!row || row.status === "delivered") return false;
		const staleAt = Date.now() - Math.max(30, args.staleAfterSeconds) * 1_000;
		if (row.status === "claimed" && row.claimToken !== args.claimToken && row.claimedAt && new Date(row.claimedAt).getTime() > staleAt) return false;
		await tx.update(gatewayAsyncWebhookDeliveries).set({ status: "claimed", claimToken: args.claimToken, claimedAt: now, updatedAt: now }).where(deliveryWhere(args));
		return true;
	}));
}

export async function completeWebhookDelivery(args: DeliveryIdentity): Promise<boolean> {
	return withDatabase(async (db) => (await db.update(gatewayAsyncWebhookDeliveries).set({ status: "delivered", claimToken: null, deliveredAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
		.where(and(deliveryWhere(args), eq(gatewayAsyncWebhookDeliveries.status, "claimed"), eq(gatewayAsyncWebhookDeliveries.claimToken, args.claimToken))).returning({ key: gatewayAsyncWebhookDeliveries.deliveryKey })).length > 0);
}

export async function releaseWebhookDelivery(args: DeliveryIdentity): Promise<boolean> {
	return withDatabase(async (db) => (await db.update(gatewayAsyncWebhookDeliveries).set({ status: "pending", claimToken: null, claimedAt: null, updatedAt: new Date().toISOString() })
		.where(and(deliveryWhere(args), eq(gatewayAsyncWebhookDeliveries.status, "claimed"), eq(gatewayAsyncWebhookDeliveries.claimToken, args.claimToken))).returning({ key: gatewayAsyncWebhookDeliveries.deliveryKey })).length > 0);
}

export async function listPendingWebhookDeliveries(limit: number) {
	return withDatabase((db) => db.select({
		workspace_id: gatewayAsyncWebhookDeliveries.workspaceId, kind: gatewayAsyncWebhookDeliveries.kind,
		internal_id: gatewayAsyncWebhookDeliveries.internalId, delivery_key: gatewayAsyncWebhookDeliveries.deliveryKey,
		event_type: gatewayAsyncWebhookDeliveries.eventType, phase: gatewayAsyncWebhookDeliveries.phase,
		progress: gatewayAsyncWebhookDeliveries.progress, previous_status: gatewayAsyncWebhookDeliveries.previousStatus,
		current_status: gatewayAsyncWebhookDeliveries.currentStatus,
	}).from(gatewayAsyncWebhookDeliveries).where(and(
		eq(gatewayAsyncWebhookDeliveries.status, "pending"), inArray(gatewayAsyncWebhookDeliveries.kind, ["video", "batch"]),
		ne(gatewayAsyncWebhookDeliveries.eventType, ""), ne(gatewayAsyncWebhookDeliveries.phase, ""),
		lte(gatewayAsyncWebhookDeliveries.nextAttemptAt, new Date().toISOString()),
	)).orderBy(asc(gatewayAsyncWebhookDeliveries.nextAttemptAt)).limit(limit));
}

function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export async function recordWebhookResult(args: {
	workspaceId: string; kind: string; internalId: string; deliveryKey: string; attempt: Record<string, unknown>;
	retryState: Record<string, unknown> | null; deliveredAt: string | null; nextRetryAt: string | null;
	progress: number | null; telemetryPatch: Record<string, unknown> | null;
}): Promise<void> {
	await withDatabase((db) => db.transaction(async (tx) => {
		const [operation] = await tx.select({ meta: gatewayAsyncOperations.meta }).from(gatewayAsyncOperations).where(and(
			eq(gatewayAsyncOperations.workspaceId, args.workspaceId), eq(gatewayAsyncOperations.kind, args.kind), eq(gatewayAsyncOperations.internalId, args.internalId),
		)).limit(1).for("update");
		if (!operation) return;
		const meta = object(operation.meta);
		const attempts = [...(Array.isArray(meta.webhookAttempts) ? meta.webhookAttempts : []), args.attempt].slice(-50);
		const queue = { ...object(meta.webhookRetryQueue) };
		if (args.retryState) queue[args.deliveryKey] = args.retryState; else delete queue[args.deliveryKey];
		const deliveries = { ...object(meta.webhookDeliveries) };
		if (args.deliveredAt) deliveries[args.deliveryKey] = args.deliveredAt;
		const retryTimes = Object.values(queue).map((item) => object(item).nextRetryAt).filter((value): value is string => typeof value === "string" && Boolean(value)).sort();
		const reserved = new Set(["webhookAttempts", "webhookRetryQueue", "webhookDeliveries", "nextWebhookRetryAt", "lastWebhookDispatchedAt", "lastWebhookProgress", "lastWebhookProgressAt"]);
		const telemetry = Object.fromEntries(Object.entries(object(args.telemetryPatch)).filter(([key]) => !reserved.has(key)));
		const now = new Date().toISOString();
		const nextMeta = { ...meta, webhookAttempts: attempts, webhookRetryQueue: queue, webhookDeliveries: deliveries, nextWebhookRetryAt: retryTimes[0] ?? null, lastWebhookDispatchedAt: now, ...telemetry, ...(args.progress == null ? {} : { lastWebhookProgress: args.progress, lastWebhookProgressAt: now }) };
		await tx.update(gatewayAsyncOperations).set({ meta: nextMeta, updatedAt: now }).where(and(eq(gatewayAsyncOperations.workspaceId, args.workspaceId), eq(gatewayAsyncOperations.kind, args.kind), eq(gatewayAsyncOperations.internalId, args.internalId)));
		await tx.update(gatewayAsyncWebhookDeliveries).set({
			...(args.deliveredAt ? { status: "delivered" } : args.nextRetryAt == null ? { status: "failed", claimToken: null, claimedAt: null } : {}),
			deliveredAt: args.deliveredAt ?? undefined, nextAttemptAt: args.nextRetryAt,
			lastError: typeof args.attempt.error_message === "string" ? args.attempt.error_message : null, updatedAt: now,
		}).where(deliveryWhere(args));
	}));
}

export async function updateWebhookDelivery(args: Omit<DeliveryIdentity, "claimToken"> & { status: "failed" | "delivered"; reason?: string }): Promise<void> {
	await withDatabase(async (db) => { const now = new Date().toISOString(); await db.update(gatewayAsyncWebhookDeliveries).set({ status: args.status, lastError: args.reason, ...(args.status === "delivered" ? { deliveredAt: now } : {}), updatedAt: now }).where(and(deliveryWhere(args), eq(gatewayAsyncWebhookDeliveries.status, "pending"))); });
}

export async function claimOperationsForReconciliation(args: { kind: string; limit: number; statuses: string[] | null; workerId: string; leaseSeconds: number; shardCount: number; shardIndex: number }) {
	const statusPredicate = reconciliationStatusPredicate(args.statuses);
	return withDatabase(async (db) => [...await db.execute(sql`
		with candidates as (
			select id from ${gatewayAsyncOperations}
			where kind=${args.kind} and billed_at is null and (next_reconcile_at is null or next_reconcile_at <= now())
			and (reconcile_locked_at is null or reconcile_locked_at < now() - (${args.leaseSeconds} * interval '1 second'))
			and ${statusPredicate}
			and not (kind='batch' and meta->>'resource'='file')
			and (${args.shardCount}=1 or mod(mod(hashtextextended(workspace_id::text || ':' || internal_id, 0), ${args.shardCount}::bigint)+${args.shardCount}::bigint, ${args.shardCount}::bigint)=${args.shardIndex}::bigint)
			order by next_reconcile_at asc nulls first, updated_at asc limit ${args.limit} for update skip locked
		), claimed as (
			update ${gatewayAsyncOperations} op set reconcile_locked_at=now(), reconcile_locked_by=${args.workerId}, reconcile_attempts=op.reconcile_attempts+1, updated_at=now()
			from candidates where op.id=candidates.id returning op.*
		) select workspace_id,kind,internal_id,request_id,session_id,app_id,provider,native_id,model,status,meta,billed_at,next_reconcile_at,reconcile_attempts,reconcile_locked_at,reconcile_locked_by,last_reconcile_error,created_at,updated_at from claimed order by next_reconcile_at asc nulls first, updated_at asc
	`)]);
}

export async function updateReconciliation(args: { workspaceId: string; kind: string; internalId: string; nextReconcileAt?: string | null; lastError: string | null; clearLease: boolean }): Promise<void> {
	await withDatabase(async (db) => { await db.update(gatewayAsyncOperations).set({ lastReconcileError: args.lastError, ...(Object.prototype.hasOwnProperty.call(args, "nextReconcileAt") ? { nextReconcileAt: args.nextReconcileAt } : {}), ...(args.clearLease ? { reconcileLockedAt: null, reconcileLockedBy: null } : {}), updatedAt: new Date().toISOString() }).where(and(eq(gatewayAsyncOperations.workspaceId, args.workspaceId), eq(gatewayAsyncOperations.kind, args.kind), eq(gatewayAsyncOperations.internalId, args.internalId))); });
}

export async function findOperation(workspaceId: string, kind: string, internalId: string) {
	return withDatabase(async (db) => (await db.select(operationSelection).from(gatewayAsyncOperations).where(and(eq(gatewayAsyncOperations.workspaceId, workspaceId), eq(gatewayAsyncOperations.kind, kind), eq(gatewayAsyncOperations.internalId, internalId))).limit(1))[0] ?? null);
}

export async function findOperationByNativeId(kind: string, provider: string, nativeId: string) {
	return withDatabase((db) => db.select(operationSelection).from(gatewayAsyncOperations).where(and(eq(gatewayAsyncOperations.kind, kind), eq(gatewayAsyncOperations.provider, provider), eq(gatewayAsyncOperations.nativeId, nativeId))).orderBy(desc(gatewayAsyncOperations.createdAt)).limit(2));
}

export async function markOperationBilled(workspaceId: string, kind: string, internalId: string): Promise<boolean> {
	return withDatabase(async (db) => (await db.update(gatewayAsyncOperations).set({ billedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), nextReconcileAt: null, reconcileLockedAt: null, reconcileLockedBy: null, lastReconcileError: null }).where(and(eq(gatewayAsyncOperations.workspaceId, workspaceId), eq(gatewayAsyncOperations.kind, kind), eq(gatewayAsyncOperations.internalId, internalId), isNull(gatewayAsyncOperations.billedAt))).returning({ id: gatewayAsyncOperations.id })).length > 0);
}

export async function setOperationStatus(args: { workspaceId: string; kind: string; internalId: string; status: string | null; metaPatch: Record<string, unknown>; updateNextReconcile: boolean; nextReconcileAt: string | null }): Promise<void> {
	await withDatabase(async (db) => { await db.execute(sql`update ${gatewayAsyncOperations} set
		status=case when ${args.status}::text is null then status when lower(coalesce(status,'')) in ('completed','failed','cancelled','canceled','expired') then status
		when (case lower(${args.status}::text) when 'queued' then 1 when 'pending' then 1 when 'in_progress' then 2 when 'processing' then 2 when 'running' then 2 when 'completed' then 3 when 'failed' then 3 when 'cancelled' then 3 when 'canceled' then 3 when 'expired' then 3 else 0 end) < (case lower(coalesce(status,'')) when 'queued' then 1 when 'pending' then 1 when 'in_progress' then 2 when 'processing' then 2 when 'running' then 2 when 'completed' then 3 when 'failed' then 3 when 'cancelled' then 3 when 'canceled' then 3 when 'expired' then 3 else 0 end) then status else ${args.status}::text end,
		meta=coalesce(meta,'{}'::jsonb) || ${JSON.stringify(args.metaPatch)}::jsonb,
		next_reconcile_at=case when ${args.updateNextReconcile} then ${args.nextReconcileAt}::timestamptz else next_reconcile_at end, updated_at=now()
		where workspace_id=${args.workspaceId}::uuid and kind=${args.kind} and internal_id=${args.internalId}`); });
}

export async function patchOperationIdentity(workspaceId: string, kind: string, internalId: string, patch: Partial<typeof gatewayAsyncOperations.$inferInsert>): Promise<void> {
	await withDatabase(async (db) => { await db.update(gatewayAsyncOperations).set({ ...patch, updatedAt: new Date().toISOString() }).where(and(eq(gatewayAsyncOperations.workspaceId, workspaceId), eq(gatewayAsyncOperations.kind, kind), eq(gatewayAsyncOperations.internalId, internalId))); });
}
