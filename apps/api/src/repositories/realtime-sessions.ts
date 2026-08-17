import { creditLedger, gatewayRealtimeSessions, gatewayWalletReservations, wallets } from "@phaseo/db/schema";
import { and, eq, inArray, sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

type Row = Record<string, any>;
const activeStatuses = ["created", "connecting", "connected", "ending", "billing_unresolved"];
const terminalStatuses = ["completed", "failed", "cancelled", "expired"];

export function realtimeStatusPredicate(statuses: string[]) {
	return inArray(sql.raw("status"), statuses);
}

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function createSessionWithHold(args: {
	workspaceId: string; sessionId: string; keyId: string; userId: string | null; source: string; provider: string;
	modelId: string; providerModelId: string; voice: string; expiresAt: string; reservationPrefix: string;
	reservationId: string; holdNanos: number; clientSecretHash: string | null; metadata: Record<string, unknown>;
	maxWorkspaceSessions: number; maxKeySessions: number; maxUserSessions: number; maxCreationsPerMinute: number;
}): Promise<Row> {
	return withDatabase((db) => db.transaction(async (tx) => {
		const [wallet] = await tx.execute<Row>(sql`select * from ${wallets} where workspace_id=${args.workspaceId}::uuid for update`);
		if (!wallet) throw new Error("wallet_not_found");
		const [counts] = await tx.execute<Row>(sql`select
			count(*) filter(where ${realtimeStatusPredicate(activeStatuses)})::int workspace_count,
			count(*) filter(where key_id=${args.keyId}::uuid and ${realtimeStatusPredicate(activeStatuses)})::int key_count,
			count(*) filter(where user_id=${args.userId} and ${realtimeStatusPredicate(activeStatuses)})::int user_count,
			count(*) filter(where created_at >= now()-interval '1 minute')::int minute_count
			from ${gatewayRealtimeSessions} where workspace_id=${args.workspaceId}::uuid`);
		if (Number(counts?.workspace_count ?? 0) >= Math.max(1, args.maxWorkspaceSessions)) throw new Error("realtime_workspace_concurrency_limit");
		if (Number(counts?.key_count ?? 0) >= Math.max(1, args.maxKeySessions)) throw new Error("realtime_key_concurrency_limit");
		if (args.userId && Number(counts?.user_count ?? 0) >= Math.max(1, args.maxUserSessions)) throw new Error("realtime_user_concurrency_limit");
		if (Number(counts?.minute_count ?? 0) >= Math.max(1, args.maxCreationsPerMinute)) throw new Error("realtime_creation_rate_limit");
		if (Number(wallet.balance_nanos ?? 0) - Number(wallet.reserved_nanos ?? 0) < args.holdNanos) throw new Error("insufficient_funds");
		const [session] = await tx.execute<Row>(sql`insert into ${gatewayRealtimeSessions}
			(session_id,workspace_id,key_id,user_id,source,provider,model_id,provider_model_id,voice,status,expires_at,reservation_prefix,reservation_count,reserved_nanos,provider_client_secret_hash,metadata)
			values(${args.sessionId},${args.workspaceId}::uuid,${args.keyId}::uuid,${args.userId},${args.source},${args.provider},${args.modelId},${args.providerModelId},${args.voice},'created',${args.expiresAt}::timestamptz,${args.reservationPrefix},1,${args.holdNanos},${args.clientSecretHash},${JSON.stringify(args.metadata)}::jsonb) returning *`);
		await tx.insert(gatewayWalletReservations).values({ reservationId: args.reservationId, workspaceId: args.workspaceId, amountNanos: args.holdNanos, status: "reserved", holdRefId: args.sessionId, capturedNanos: 0, releasedNanos: 0 });
		await tx.execute(sql`insert into observability.gateway_requests(workspace_id,request_id,realtime_session_id,endpoint,model_id,provider,stream,byok,status_code,success,usage,cost_nanos,currency,pricing_lines,key_id,created_at)
			values(${args.workspaceId}::uuid,${`realtime:${args.sessionId}`},${args.sessionId},'audio.realtime',${args.modelId},${args.provider},true,false,102,false,'{}'::jsonb,0,'USD','[]'::jsonb,${args.keyId}::uuid,${session.started_at}::timestamptz)`);
		await tx.update(wallets).set({ reservedNanos: Number(wallet.reserved_nanos ?? 0) + args.holdNanos, updatedAt: new Date().toISOString() }).where(eq(wallets.workspaceId, args.workspaceId));
		return session;
	}));
}

export async function findSession(workspaceId: string | null, sessionId: string): Promise<Row | null> {
	return withDatabase(async (db) => (await db.execute<Row>(workspaceId
		? sql`select * from ${gatewayRealtimeSessions} where workspace_id=${workspaceId}::uuid and session_id=${sessionId} limit 1`
		: sql`select * from ${gatewayRealtimeSessions} where session_id=${sessionId} limit 1`))[0] ?? null);
}

export async function updateProviderSession(workspaceId: string, sessionId: string, patch: { secretHash: string; providerSessionId: string | null; expiresAt: string }) {
	return withDatabase(async (db) => (await db.execute<Row>(sql`update ${gatewayRealtimeSessions} set provider_client_secret_hash=${patch.secretHash},provider_session_id=${patch.providerSessionId},expires_at=${patch.expiresAt}::timestamptz,updated_at=now() where workspace_id=${workspaceId}::uuid and session_id=${sessionId} returning *`))[0] ?? null);
}

export async function claimConnection(sessionId: string, secretHash: string): Promise<Row> {
	return withDatabase((db) => db.transaction(async (tx) => {
		const [session] = await tx.execute<Row>(sql`select * from ${gatewayRealtimeSessions} where session_id=${sessionId} for update`);
		if (!session) throw new Error("realtime_session_not_found");
		if (String(session.provider_client_secret_hash ?? "") !== secretHash) throw new Error("realtime_relay_forbidden");
		if (session.status !== "created") throw new Error("realtime_relay_already_connected");
		if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) throw new Error("realtime_session_expired");
		const [updated] = await tx.execute<Row>(sql`update ${gatewayRealtimeSessions} set status='connecting',last_event_at=now(),updated_at=now() where id=${session.id}::uuid and status='created' returning *`);
		if (!updated) throw new Error("realtime_relay_already_connected");
		return updated;
	}));
}

export async function extendHold(args: { workspaceId: string; sessionId: string; reservationId: string; targetReservedNanos: number; estimatedCostNanos: number }): Promise<Row> {
	return withDatabase((db) => db.transaction(async (tx) => {
		const [wallet] = await tx.execute<Row>(sql`select * from ${wallets} where workspace_id=${args.workspaceId}::uuid for update`);
		if (!wallet) throw new Error("wallet_not_found");
		const [session] = await tx.execute<Row>(sql`select * from ${gatewayRealtimeSessions} where workspace_id=${args.workspaceId}::uuid and session_id=${args.sessionId} for update`);
		if (!session) throw new Error("realtime_session_not_found");
		if (!["created", "connecting", "connected", "ending"].includes(session.status)) throw new Error("realtime_session_terminal");
		const additional = Math.max(0, args.targetReservedNanos - Number(session.reserved_nanos ?? 0));
		if (additional > 0) {
			if (Number(wallet.balance_nanos ?? 0) - Number(wallet.reserved_nanos ?? 0) < additional) {
				await tx.execute(sql`update ${gatewayRealtimeSessions} set status='ending',disconnect_reason='credit_hold_extension_failed',error_code='insufficient_funds',updated_at=now() where id=${session.id}::uuid`);
				throw new Error("insufficient_funds");
			}
			await tx.insert(gatewayWalletReservations).values({ reservationId: args.reservationId, workspaceId: args.workspaceId, amountNanos: additional, status: "reserved", holdRefId: args.sessionId, capturedNanos: 0, releasedNanos: 0 });
			await tx.update(wallets).set({ reservedNanos: Number(wallet.reserved_nanos ?? 0) + additional, updatedAt: new Date().toISOString() }).where(eq(wallets.workspaceId, args.workspaceId));
		}
		return (await tx.execute<Row>(sql`update ${gatewayRealtimeSessions} set reservation_count=reservation_count+${additional > 0 ? 1 : 0},reserved_nanos=reserved_nanos+${additional},estimated_cost_nanos=greatest(estimated_cost_nanos,${args.estimatedCostNanos}),last_event_at=now(),updated_at=now() where id=${session.id}::uuid returning *`))[0];
	}));
}

export async function markConnected(workspaceId: string, sessionId: string, keyId: string): Promise<Row | null> {
	return withDatabase(async (db) => (await db.execute<Row>(sql`update ${gatewayRealtimeSessions} set status='connected',connected_at=now(),last_event_at=now(),updated_at=now() where workspace_id=${workspaceId}::uuid and session_id=${sessionId} and status='connecting' and key_id=${keyId}::uuid returning *`))[0] ?? null);
}

export async function updateUsage(args: { workspaceId: string; sessionId: string; usage: Record<string, unknown>; pricingLines: unknown[]; estimatedCostNanos: number; endingReason?: string }): Promise<Row | null> {
	return withDatabase(async (db) => (await db.execute<Row>(sql`update ${gatewayRealtimeSessions} set
		status=case when ${args.endingReason}::text is null then status else 'ending' end,
		disconnect_reason=coalesce(${args.endingReason},disconnect_reason),error_code=coalesce(${args.endingReason},error_code),
		usage=${JSON.stringify(args.usage)}::jsonb,pricing_lines=${JSON.stringify(args.pricingLines)}::jsonb,estimated_cost_nanos=${args.estimatedCostNanos},last_event_at=now(),updated_at=now()
		where workspace_id=${args.workspaceId}::uuid and session_id=${args.sessionId} and ${realtimeStatusPredicate(["connecting", "connected", "ending"])} returning *`))[0] ?? null);
}

export async function markBillingUnresolved(workspaceId: string, sessionId: string, usage: Record<string, unknown>, reason: string): Promise<Row> {
	return withDatabase((db) => db.transaction(async (tx) => {
		let [session] = await tx.execute<Row>(sql`update ${gatewayRealtimeSessions} set status='billing_unresolved',usage=${JSON.stringify(usage)}::jsonb,disconnect_reason=${reason.slice(0, 240)},error_code='realtime_authoritative_usage_missing',last_event_at=now(),updated_at=now() where workspace_id=${workspaceId}::uuid and session_id=${sessionId} and ${realtimeStatusPredicate(activeStatuses)} returning *`);
		if (!session) [session] = await tx.execute<Row>(sql`select * from ${gatewayRealtimeSessions} where workspace_id=${workspaceId}::uuid and session_id=${sessionId}`);
		if (!session) throw new Error("realtime_session_not_found");
		if (terminalStatuses.includes(session.status)) return session;
		const updated = await tx.execute(sql`update observability.gateway_requests set status_code=202,success=false,error_code='realtime_authoritative_usage_missing',error_message='Realtime billing requires reconciliation.',usage=${JSON.stringify(usage)}::jsonb where realtime_session_id=${sessionId} and created_at=${session.started_at}::timestamptz returning id`);
		if (updated.length !== 1) throw new Error("realtime_request_summary_missing");
		return session;
	}));
}

export type Settlement = { applied: boolean; already_applied: boolean; status: string; final_cost_nanos: number; reserved_nanos: number; captured_nanos: number; released_nanos: number; before_balance_nanos: number | null; after_balance_nanos: number | null; before_reserved_nanos: number | null; after_reserved_nanos: number | null };

export async function settleOnce(args: { workspaceId: string; sessionId: string; costNanos: number; usage: Record<string, unknown>; pricingLines: unknown[]; status: string; disconnectReason: string | null; errorCode: string | null; errorMessage: string | null }): Promise<Settlement> {
	return withDatabase((db) => db.transaction(async (tx) => {
		let [session] = await tx.execute<Row>(sql`select * from ${gatewayRealtimeSessions} where workspace_id=${args.workspaceId}::uuid and session_id=${args.sessionId} for update`);
		if (!session) return { applied: false, already_applied: false, status: "not_found", final_cost_nanos: 0, reserved_nanos: 0, captured_nanos: 0, released_nanos: 0, before_balance_nanos: null, after_balance_nanos: null, before_reserved_nanos: null, after_reserved_nanos: null };
		if (terminalStatuses.includes(session.status)) return { applied: false, already_applied: true, status: session.status, final_cost_nanos: Number(session.final_cost_nanos ?? 0), reserved_nanos: Number(session.reserved_nanos ?? 0), captured_nanos: Number(session.captured_nanos ?? 0), released_nanos: Number(session.released_nanos ?? 0), before_balance_nanos: null, after_balance_nanos: null, before_reserved_nanos: null, after_reserved_nanos: null };
		const reservations = [...await tx.execute<Row>(sql`select * from ${gatewayWalletReservations} where workspace_id=${args.workspaceId}::uuid and ${realtimeStatusPredicate(["held", "reserved"])} and (hold_ref_id=${args.sessionId} or reservation_id like ${`${session.reservation_prefix}%`}) order by created_at,reservation_id for update`)];
		const [wallet] = await tx.execute<Row>(sql`select * from ${wallets} where workspace_id=${args.workspaceId}::uuid for update`);
		if (!wallet) throw new Error("wallet_not_found");
		const held = reservations.reduce((sum, row) => sum + Number(row.amount_nanos ?? 0), 0);
		const beforeBalance = Number(wallet.balance_nanos ?? 0), beforeReserved = Number(wallet.reserved_nanos ?? 0);
		if (beforeReserved < held) return { applied: false, already_applied: false, status: "reserved_balance_mismatch", final_cost_nanos: args.costNanos, reserved_nanos: held, captured_nanos: 0, released_nanos: held, before_balance_nanos: beforeBalance, after_balance_nanos: beforeBalance, before_reserved_nanos: beforeReserved, after_reserved_nanos: beforeReserved };
		if (args.costNanos > held + Math.max(0, beforeBalance - beforeReserved)) return { applied: false, already_applied: false, status: "insufficient_unreserved_balance", final_cost_nanos: args.costNanos, reserved_nanos: held, captured_nanos: 0, released_nanos: held, before_balance_nanos: beforeBalance, after_balance_nanos: beforeBalance, before_reserved_nanos: beforeReserved, after_reserved_nanos: beforeReserved };
		await tx.update(wallets).set({ balanceNanos: beforeBalance - args.costNanos, reservedNanos: beforeReserved - held, updatedAt: new Date().toISOString() }).where(eq(wallets.workspaceId, args.workspaceId));
		let remaining = Math.min(args.costNanos, held); const now = new Date().toISOString();
		for (const reservation of reservations) { const captured = Math.min(Number(reservation.amount_nanos), remaining); const released = Number(reservation.amount_nanos) - captured; await tx.update(gatewayWalletReservations).set({ status: captured > 0 ? "captured" : "released", capturedNanos: captured, releasedNanos: released, captureRefId: captured > 0 ? args.sessionId : null, releaseRefId: released > 0 ? args.sessionId : null, capturedAt: captured > 0 ? now : null, releasedAt: released > 0 ? now : null, updatedAt: now }).where(and(eq(gatewayWalletReservations.workspaceId, args.workspaceId), eq(gatewayWalletReservations.reservationId, reservation.reservation_id))); remaining = Math.max(0, remaining - captured); }
		if (args.costNanos > 0) await tx.insert(creditLedger).values({ workspaceId: args.workspaceId, eventTime: now, kind: "charge", amountNanos: -args.costNanos, beforeBalanceNanos: beforeBalance, afterBalanceNanos: beforeBalance - args.costNanos, beforeReservedNanos: beforeReserved, afterReservedNanos: beforeReserved - held, refType: "realtime_session", refId: args.sessionId, status: "captured" }).onConflictDoNothing({ target: [creditLedger.refType, creditLedger.refId] });
		[session] = await tx.execute<Row>(sql`update ${gatewayRealtimeSessions} set status=${args.status},ended_at=coalesce(ended_at,now()),final_cost_nanos=${args.costNanos},captured_nanos=${args.costNanos},released_nanos=${Math.max(0, held - Math.min(args.costNanos, held))},reserved_nanos=${held},usage=${JSON.stringify(args.usage)}::jsonb,pricing_lines=${JSON.stringify(args.pricingLines)}::jsonb,disconnect_reason=${args.disconnectReason},error_code=${args.errorCode},error_message=${args.errorMessage},updated_at=now() where id=${session.id}::uuid returning *`);
		const summary = await tx.execute(sql`update observability.gateway_requests set native_response_id=coalesce(${session.provider_session_id},${session.provider_native_id}),status_code=${args.status === "completed" ? 200 : 499},success=${args.status === "completed"},error_code=${args.errorCode},error_message=${args.errorMessage},generation_ms=greatest(0,floor(extract(epoch from (${session.ended_at}::timestamptz-${session.started_at}::timestamptz))*1000))::int,usage=${JSON.stringify(args.usage)}::jsonb,cost_nanos=${args.costNanos},currency='USD',pricing_lines=${JSON.stringify(args.pricingLines)}::jsonb where realtime_session_id=${args.sessionId} and created_at=${session.started_at}::timestamptz returning id`);
		if (summary.length !== 1) throw new Error("realtime_request_summary_missing");
		return { applied: true, already_applied: false, status: session.status, final_cost_nanos: args.costNanos, reserved_nanos: held, captured_nanos: args.costNanos, released_nanos: Math.max(0, held - Math.min(args.costNanos, held)), before_balance_nanos: beforeBalance, after_balance_nanos: beforeBalance - args.costNanos, before_reserved_nanos: beforeReserved, after_reserved_nanos: beforeReserved - held };
	}));
}

export async function findRequestSummary(sessionId: string, startedAt: string): Promise<{ id: string; created_at: string } | null> {
	return withDatabase(async (db) => (await db.execute<{ id: string; created_at: string }>(sql`select id,created_at from observability.gateway_requests where realtime_session_id=${sessionId} and created_at=${startedAt}::timestamptz limit 1`))[0] ?? null);
}

export async function listExpiredActiveSessions(now: string, idleCutoff: string, limit: number): Promise<Row[]> {
	return withDatabase(async (db) => [...await db.execute<Row>(sql`select * from ${gatewayRealtimeSessions} where ${realtimeStatusPredicate(["created", "connecting", "connected", "ending"])} and (expires_at <= ${now}::timestamptz or last_event_at <= ${idleCutoff}::timestamptz) order by updated_at asc limit ${limit}`)]);
}

export async function countUnresolvedSessions(updatedBefore: string): Promise<number> {
	return withDatabase((db) => db.$count(gatewayRealtimeSessions, and(eq(gatewayRealtimeSessions.status, "billing_unresolved"), sql`${gatewayRealtimeSessions.updatedAt} <= ${updatedBefore}::timestamptz`)));
}
