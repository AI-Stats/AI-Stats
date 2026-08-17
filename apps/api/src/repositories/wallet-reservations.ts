import { gatewayAsyncOperations, gatewayWalletReservations, keys, wallets } from "@phaseo/db/schema";
import { and, eq, inArray, sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

type ReservationResult = {
	ok: boolean; applied: boolean; reason: string | null; amount_nanos: number | null;
	before_balance_nanos: number | null; after_balance_nanos: number | null;
	before_reserved_nanos: number | null; after_reserved_nanos: number | null;
};

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

function result(args: Partial<ReservationResult> & Pick<ReservationResult, "ok" | "applied" | "reason">): ReservationResult {
	return { amount_nanos: null, before_balance_nanos: null, after_balance_nanos: null,
		before_reserved_nanos: null, after_reserved_nanos: null, ...args };
}

function walletResult(wallet: typeof wallets.$inferSelect, amount: number, args: Pick<ReservationResult, "ok" | "applied" | "reason">): ReservationResult {
	return result({ ...args, amount_nanos: amount, before_balance_nanos: wallet.balanceNanos,
		after_balance_nanos: wallet.balanceNanos, before_reserved_nanos: wallet.reservedNanos,
		after_reserved_nanos: wallet.reservedNanos });
}

export async function reserve(args: {
	workspaceId: string; reservationId: string; amountNanos: number; holdRefId?: string | null;
	keyId?: string | null; requestCount?: number | null;
}): Promise<ReservationResult> {
	if (!args.workspaceId || !args.reservationId.trim()) throw new Error("invalid_reservation_identity");
	if (!Number.isSafeInteger(args.amountNanos) || args.amountNanos <= 0) throw new Error("invalid_reservation_amount");
	const requestedCount = Math.max(0, Math.trunc(args.requestCount ?? 0));
	if (args.keyId && requestedCount <= 0) throw new Error("batch_request_count_required");
	if (requestedCount > 10_000) throw new Error("batch_request_limit_exceeded");
	return withDatabase((db) => db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${args.workspaceId}:${args.reservationId}`}, 0))`);
		const [existing] = await tx.select().from(gatewayWalletReservations).where(and(
			eq(gatewayWalletReservations.workspaceId, args.workspaceId),
			eq(gatewayWalletReservations.reservationId, args.reservationId),
		)).limit(1).for("update");
		if (existing) {
			const [wallet] = await tx.select().from(wallets).where(eq(wallets.workspaceId, args.workspaceId)).limit(1).for("update");
			if (!wallet) return result({ ok: false, applied: false, reason: "wallet_not_found", amount_nanos: args.amountNanos });
			if (existing.amountNanos !== args.amountNanos || existing.keyId !== (args.keyId ?? null)
				|| (existing.requestCount ?? 0) !== requestedCount) throw new Error("reservation_identity_mismatch");
			return walletResult(wallet, existing.amountNanos, { ok: ["held", "reserved"].includes(existing.status), applied: false,
				reason: ["held", "reserved"].includes(existing.status) ? "already_reserved" : "reservation_not_active" });
		}

		if (args.keyId) {
			const [key] = await tx.select().from(keys).where(eq(keys.id, args.keyId)).limit(1).for("update");
			if (!key) return result({ ok: false, applied: false, reason: "key_not_found", amount_nanos: args.amountNanos });
			if (key.workspaceId !== args.workspaceId) return result({ ok: false, applied: false, reason: "key_wrong_workspace", amount_nanos: args.amountNanos });
			if (key.status !== "active" || (key.expiresAt && Date.parse(key.expiresAt) <= Date.now())) return result({ ok: false, applied: false, reason: "key_not_active", amount_nanos: args.amountNanos });
			if (key.softBlocked) return result({ ok: false, applied: false, reason: "key_limit_soft_blocked", amount_nanos: args.amountNanos });
			const usageRows = [...await tx.execute<Record<string, unknown>>(sql`
				select count(*) filter (where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc')::bigint day_requests,
					count(*) filter (where created_at >= date_trunc('week', now() at time zone 'utc') at time zone 'utc')::bigint week_requests,
					count(*) filter (where created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc')::bigint month_requests,
					coalesce(sum(cost_nanos) filter (where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'),0)::bigint day_cost,
					coalesce(sum(cost_nanos) filter (where created_at >= date_trunc('week', now() at time zone 'utc') at time zone 'utc'),0)::bigint week_cost,
					coalesce(sum(cost_nanos) filter (where created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'),0)::bigint month_cost
				from observability.gateway_requests where workspace_id=${args.workspaceId}::uuid and key_id=${args.keyId}::uuid and success=true
			`)];
			const usage = usageRows[0] ?? {};
			const n = (value: unknown) => Number(value ?? 0);
			if (key.dailyLimitRequests > 0 && n(usage.day_requests) + requestedCount > key.dailyLimitRequests) return result({ ok: false, applied: false, reason: "daily_request_limit_reached", amount_nanos: args.amountNanos });
			if (key.weeklyLimitRequests > 0 && n(usage.week_requests) + requestedCount > key.weeklyLimitRequests) return result({ ok: false, applied: false, reason: "weekly_request_limit_reached", amount_nanos: args.amountNanos });
			if (key.monthlyLimitRequests > 0 && n(usage.month_requests) + requestedCount > key.monthlyLimitRequests) return result({ ok: false, applied: false, reason: "monthly_request_limit_reached", amount_nanos: args.amountNanos });
			if (key.dailyLimitCostNanos > 0 && n(usage.day_cost) + args.amountNanos > key.dailyLimitCostNanos) return result({ ok: false, applied: false, reason: "daily_cost_limit_reached", amount_nanos: args.amountNanos });
			if (key.weeklyLimitCostNanos > 0 && n(usage.week_cost) + args.amountNanos > key.weeklyLimitCostNanos) return result({ ok: false, applied: false, reason: "weekly_cost_limit_reached", amount_nanos: args.amountNanos });
			if (key.monthlyLimitCostNanos > 0 && n(usage.month_cost) + args.amountNanos > key.monthlyLimitCostNanos) return result({ ok: false, applied: false, reason: "monthly_cost_limit_reached", amount_nanos: args.amountNanos });
		}

		const [wallet] = await tx.select().from(wallets).where(eq(wallets.workspaceId, args.workspaceId)).limit(1).for("update");
		if (!wallet) return result({ ok: false, applied: false, reason: "wallet_not_found", amount_nanos: args.amountNanos });
		if (wallet.balanceNanos - wallet.reservedNanos < args.amountNanos) return walletResult(wallet, args.amountNanos, { ok: false, applied: false, reason: "insufficient_balance" });
		const now = new Date().toISOString();
		await tx.insert(gatewayWalletReservations).values({ reservationId: args.reservationId, workspaceId: args.workspaceId,
			amountNanos: args.amountNanos, status: "reserved", holdRefId: args.holdRefId?.trim() || null,
			keyId: args.keyId ?? null, requestCount: requestedCount || null, createdAt: now, updatedAt: now });
		await tx.update(wallets).set({ reservedNanos: wallet.reservedNanos + args.amountNanos, updatedAt: now }).where(eq(wallets.workspaceId, args.workspaceId));
		if (args.keyId) await tx.execute(sql`
			insert into observability.gateway_requests (workspace_id,request_id,endpoint,model_id,provider,status_code,success,usage,cost_nanos,currency,key_id)
			select ${args.workspaceId}::uuid, 'batch_hold_usage:' || ${args.reservationId} || ':' || item::text,
				'batch','batch/reserved',null,202,true,'{"batch_reserved":true}'::jsonb,
				(${args.amountNanos} / ${requestedCount}) + case when item <= (${args.amountNanos} % ${requestedCount}) then 1 else 0 end,
				'USD',${args.keyId}::uuid from generate_series(1,${requestedCount}) item
		`);
		return result({ ok: true, applied: true, reason: null, amount_nanos: args.amountNanos,
			before_balance_nanos: wallet.balanceNanos, after_balance_nanos: wallet.balanceNanos,
			before_reserved_nanos: wallet.reservedNanos, after_reserved_nanos: wallet.reservedNanos + args.amountNanos });
	}));
}

async function transition(args: { workspaceId: string; reservationId: string; refId?: string | null; mode: "capture" | "release" }): Promise<ReservationResult> {
	return withDatabase((db) => db.transaction(async (tx) => {
		const [reservation] = await tx.select().from(gatewayWalletReservations).where(and(eq(gatewayWalletReservations.workspaceId, args.workspaceId), eq(gatewayWalletReservations.reservationId, args.reservationId))).limit(1).for("update");
		if (!reservation) return result({ ok: false, applied: false, reason: "reservation_not_found" });
		const [wallet] = await tx.select().from(wallets).where(eq(wallets.workspaceId, args.workspaceId)).limit(1).for("update");
		if (!wallet) return result({ ok: false, applied: false, reason: "wallet_not_found", amount_nanos: reservation.amountNanos });
		const target = args.mode === "capture" ? "captured" : "released";
		if (reservation.status === target) return walletResult(wallet, reservation.amountNanos, { ok: true, applied: false, reason: `already_${target}` });
		if (reservation.status !== "reserved") return walletResult(wallet, reservation.amountNanos, { ok: false, applied: false, reason: "reservation_not_active" });
		if (wallet.reservedNanos < reservation.amountNanos) return walletResult(wallet, reservation.amountNanos, { ok: false, applied: false, reason: "reserved_balance_mismatch" });
		const now = new Date().toISOString();
		const nextBalance = args.mode === "capture" ? wallet.balanceNanos - reservation.amountNanos : wallet.balanceNanos;
		const nextReserved = wallet.reservedNanos - reservation.amountNanos;
		await tx.update(wallets).set({ balanceNanos: nextBalance, reservedNanos: nextReserved, updatedAt: now }).where(eq(wallets.workspaceId, args.workspaceId));
		await tx.update(gatewayWalletReservations).set(args.mode === "capture"
			? { status: "captured", captureRefId: args.refId?.trim() || null, capturedAt: now, updatedAt: now }
			: { status: "released", releaseRefId: args.refId?.trim() || null, releasedAt: now, updatedAt: now })
			.where(and(eq(gatewayWalletReservations.workspaceId, args.workspaceId), eq(gatewayWalletReservations.reservationId, args.reservationId)));
		return result({ ok: true, applied: true, reason: null, amount_nanos: reservation.amountNanos,
			before_balance_nanos: wallet.balanceNanos, after_balance_nanos: nextBalance,
			before_reserved_nanos: wallet.reservedNanos, after_reserved_nanos: nextReserved });
	}));
}

export const capture = (args: { workspaceId: string; reservationId: string; captureRefId?: string | null }) => transition({ ...args, refId: args.captureRefId, mode: "capture" });
export const release = (args: { workspaceId: string; reservationId: string; releaseRefId?: string | null }) => transition({ ...args, refId: args.releaseRefId, mode: "release" });

export async function settle(args: { workspaceId: string; reservationId: string; actualNanos: number; settleRefId?: string | null }): Promise<ReservationResult> {
	if (!args.workspaceId || !args.reservationId.trim()) throw new Error("invalid_batch_reservation_identity");
	if (!Number.isSafeInteger(args.actualNanos) || args.actualNanos < 0) throw new Error("invalid_actual_nanos");
	return withDatabase((db) => db.transaction(async (tx) => {
		const [reservation] = await tx.select().from(gatewayWalletReservations).where(and(eq(gatewayWalletReservations.workspaceId, args.workspaceId), eq(gatewayWalletReservations.reservationId, args.reservationId))).limit(1).for("update");
		if (!reservation) return result({ ok: false, applied: false, reason: "reservation_not_found", amount_nanos: args.actualNanos });
		const [wallet] = await tx.select().from(wallets).where(eq(wallets.workspaceId, args.workspaceId)).limit(1).for("update");
		if (!wallet) return result({ ok: false, applied: false, reason: "wallet_not_found", amount_nanos: args.actualNanos });
		if (reservation.status === "captured") {
			if ((reservation.settledAmountNanos ?? reservation.amountNanos) !== args.actualNanos) throw new Error("reservation_settlement_amount_mismatch");
			return walletResult(wallet, args.actualNanos, { ok: true, applied: false, reason: "already_captured" });
		}
		if (!["held", "reserved"].includes(reservation.status)) return walletResult(wallet, args.actualNanos, { ok: false, applied: false, reason: "reservation_not_active" });
		if (wallet.reservedNanos < reservation.amountNanos) return walletResult(wallet, args.actualNanos, { ok: false, applied: false, reason: "reserved_balance_mismatch" });
		if (args.actualNanos > wallet.balanceNanos - wallet.reservedNanos + reservation.amountNanos) return walletResult(wallet, args.actualNanos, { ok: false, applied: false, reason: "insufficient_balance" });
		const now = new Date().toISOString();
		const nextBalance = wallet.balanceNanos - args.actualNanos;
		const nextReserved = wallet.reservedNanos - reservation.amountNanos;
		await tx.update(wallets).set({ balanceNanos: nextBalance, reservedNanos: nextReserved, updatedAt: now }).where(eq(wallets.workspaceId, args.workspaceId));
		await tx.update(gatewayWalletReservations).set({ status: "captured", settledAmountNanos: args.actualNanos,
			captureRefId: args.settleRefId?.trim() || null, capturedAt: now, updatedAt: now }).where(and(eq(gatewayWalletReservations.workspaceId, args.workspaceId), eq(gatewayWalletReservations.reservationId, args.reservationId)));
		return result({ ok: true, applied: true, reason: null, amount_nanos: args.actualNanos,
			before_balance_nanos: wallet.balanceNanos, after_balance_nanos: nextBalance,
			before_reserved_nanos: wallet.reservedNanos, after_reserved_nanos: nextReserved });
	}));
}

export async function releaseStaleOrphanBatches(olderThanSeconds: number, limit: number): Promise<number> {
	return withDatabase((db) => db.transaction(async (tx) => {
		type Row = { workspace_id: string; reservation_id: string; amount_nanos: number };
		const rows = [...await tx.execute<Row>(sql`
			select reservation.workspace_id::text,reservation.reservation_id,reservation.amount_nanos
			from ${gatewayWalletReservations} reservation
			where reservation.reservation_id like 'batch_hold:%' and reservation.status=any(${["held", "reserved"]}::text[])
				and reservation.created_at < now() - (${Math.max(300, olderThanSeconds)} * interval '1 second')
				and not exists (select 1 from ${gatewayAsyncOperations} operation where operation.workspace_id=reservation.workspace_id
					and operation.kind='batch' and (operation.request_id=reservation.hold_ref_id
						or operation.meta->>'reservationId'=reservation.reservation_id or operation.meta->>'reservation_id'=reservation.reservation_id))
			order by reservation.created_at for update skip locked limit ${Math.max(1, Math.min(limit, 1000))}
		`)];
		let released = 0;
		for (const row of rows) {
			const updated = await tx.update(wallets).set({ reservedNanos: sql`greatest(0,coalesce(${wallets.reservedNanos},0)-${row.amount_nanos})`, updatedAt: new Date().toISOString() })
				.where(and(eq(wallets.workspaceId, row.workspace_id), sql`coalesce(${wallets.reservedNanos},0)>=${row.amount_nanos}`)).returning({ id: wallets.workspaceId });
			if (!updated.length) continue;
			await tx.update(gatewayWalletReservations).set({ status: "released", releaseRefId: "stale_orphan_batch_reaper", releasedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
				.where(and(eq(gatewayWalletReservations.workspaceId, row.workspace_id), eq(gatewayWalletReservations.reservationId, row.reservation_id), inArray(gatewayWalletReservations.status, ["held", "reserved"])));
			released += 1;
		}
		return released;
	}));
}
