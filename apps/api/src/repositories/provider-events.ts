import { gatewayProviderEvents } from "@phaseo/db/schema";
import { and, eq, isNull, lte, or, sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

const selection = {
	id: gatewayProviderEvents.id, provider: gatewayProviderEvents.provider,
	provider_event_id: gatewayProviderEvents.providerEventId, kind: gatewayProviderEvents.kind,
	workspace_id: gatewayProviderEvents.workspaceId, internal_id: gatewayProviderEvents.internalId,
	payload: gatewayProviderEvents.payload, processed_at: gatewayProviderEvents.processedAt,
	attempt_count: gatewayProviderEvents.attemptCount, next_attempt_at: gatewayProviderEvents.nextAttemptAt,
	created_at: gatewayProviderEvents.createdAt,
};

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function insertProviderEvent(values: typeof gatewayProviderEvents.$inferInsert) {
	return withDatabase(async (db) => (await db.insert(gatewayProviderEvents).values(values).onConflictDoNothing({
		target: [gatewayProviderEvents.provider, gatewayProviderEvents.providerEventId],
	}).returning(selection))[0] ?? null);
}

export async function findProviderEvent(provider: string, providerEventId: string) {
	return withDatabase(async (db) => (await db.select(selection).from(gatewayProviderEvents).where(and(eq(gatewayProviderEvents.provider, provider), eq(gatewayProviderEvents.providerEventId, providerEventId))).limit(1))[0] ?? null);
}

export async function claimProviderEvents(args: { providers: string[]; limit: number; workerId: string; leaseSeconds: number }) {
	return withDatabase(async (db) => [...await db.execute(sql`
		with candidates as (
			select id from ${gatewayProviderEvents}
			where provider=any(${args.providers}::text[]) and processed_at is null and dead_lettered_at is null
			and (next_attempt_at is null or next_attempt_at <= now())
			and (replay_locked_at is null or replay_locked_at < now() - (${args.leaseSeconds} * interval '1 second'))
			order by created_at asc for update skip locked limit ${args.limit}
		) update ${gatewayProviderEvents} event set replay_locked_at=now(), replay_locked_by=${args.workerId}, updated_at=now()
		from candidates where event.id=candidates.id
		returning event.id,event.provider,event.provider_event_id,event.kind,event.workspace_id,event.internal_id,event.payload,event.processed_at,event.attempt_count,event.next_attempt_at,event.created_at
	`)]);
}

export async function claimProviderEvent(args: { provider: string; providerEventId: string; workerId: string; leaseSeconds: number }): Promise<boolean> {
	return withDatabase(async (db) => (await db.update(gatewayProviderEvents).set({ replayLockedAt: new Date().toISOString(), replayLockedBy: args.workerId, updatedAt: new Date().toISOString() }).where(and(
		eq(gatewayProviderEvents.provider, args.provider), eq(gatewayProviderEvents.providerEventId, args.providerEventId),
		isNull(gatewayProviderEvents.processedAt), isNull(gatewayProviderEvents.deadLetteredAt),
		or(isNull(gatewayProviderEvents.nextAttemptAt), lte(gatewayProviderEvents.nextAttemptAt, new Date().toISOString())),
		or(isNull(gatewayProviderEvents.replayLockedAt), sql`${gatewayProviderEvents.replayLockedAt} < now() - (${args.leaseSeconds} * interval '1 second')`),
	)).returning({ id: gatewayProviderEvents.id })).length === 1);
}

export async function deferProviderEvent(provider: string, providerEventId: string, reason: string): Promise<void> {
	await withDatabase((db) => db.transaction(async (tx) => {
		const [row] = await tx.select({ attempts: gatewayProviderEvents.attemptCount }).from(gatewayProviderEvents).where(and(eq(gatewayProviderEvents.provider, provider), eq(gatewayProviderEvents.providerEventId, providerEventId))).limit(1).for("update");
		if (!row) return;
		const attempts = row.attempts + 1;
		const deadLettered = attempts >= 20;
		const now = new Date();
		const nextAttemptAt = deadLettered ? null : new Date(now.getTime() + Math.min(1_800, 5 * (2 ** Math.min(attempts, 8))) * 1_000).toISOString();
		await tx.update(gatewayProviderEvents).set({ attemptCount: attempts, lastError: reason.slice(0, 500), nextAttemptAt, ...(deadLettered ? { deadLetteredAt: now.toISOString(), processedAt: now.toISOString() } : {}), replayLockedAt: null, replayLockedBy: null, updatedAt: now.toISOString() }).where(and(eq(gatewayProviderEvents.provider, provider), eq(gatewayProviderEvents.providerEventId, providerEventId)));
	}));
}

export async function markProviderEventProcessed(args: { provider: string; providerEventId: string; workspaceId?: string | null; internalId?: string | null }): Promise<void> {
	await withDatabase(async (db) => { const now = new Date().toISOString(); await db.update(gatewayProviderEvents).set({ processedAt: now, replayLockedAt: null, replayLockedBy: null, updatedAt: now, ...(args.workspaceId ? { workspaceId: args.workspaceId } : {}), ...(args.internalId ? { internalId: args.internalId } : {}) }).where(and(eq(gatewayProviderEvents.provider, args.provider), eq(gatewayProviderEvents.providerEventId, args.providerEventId))); });
}
