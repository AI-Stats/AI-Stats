// Purpose: Wallet reservation helpers for async billing workflows.
// Why: Long-running generation jobs require hold/capture/release semantics.
// How: Uses transactional Drizzle repositories and normalizes idempotent status responses.

import * as walletReservationRepository from "@/repositories/wallet-reservations";
import { invalidateGatewayCreditCache } from "@core/gateway-credit-cache";
import { setKeyVersion } from "@core/kv";

export type WalletReservationStatus =
	| "held"
	| "captured"
	| "released"
	| "insufficient_funds"
	| "insufficient_balance"
	| "daily_request_limit_reached"
	| "weekly_request_limit_reached"
	| "monthly_request_limit_reached"
	| "daily_cost_limit_reached"
	| "weekly_cost_limit_reached"
	| "monthly_cost_limit_reached"
	| "key_limit_soft_blocked"
	| "key_not_found"
	| "key_not_active"
	| "key_wrong_workspace"
	| "reserved_balance_mismatch"
	| "reservation_exceeded"
	| "not_found"
	| "unknown";

export type WalletReservationResult = {
	applied: boolean;
	alreadyApplied: boolean;
	status: WalletReservationStatus;
	amountNanos: number;
	beforeBalanceNanos: number | null;
	afterBalanceNanos: number | null;
	beforeReservedNanos: number | null;
	afterReservedNanos: number | null;
};

type WalletReservationRpcRow = {
	ok?: boolean | null;
	reason?: string | null;
	applied?: boolean | null;
	already_applied?: boolean | null;
	status?: string | null;
	amount_nanos?: number | null;
	before_balance_nanos?: number | null;
	after_balance_nanos?: number | null;
	before_reserved_nanos?: number | null;
	after_reserved_nanos?: number | null;
};

async function invalidateReservationCaches(workspaceId: string, keyId?: string | null): Promise<void> {
	await invalidateGatewayCreditCache(workspaceId);
	if (!keyId) return;
	try {
		await setKeyVersion("id", keyId, Date.now());
	} catch (error) {
		console.error("wallet_reservation_key_context_invalidation_failed", { workspaceId, error });
	}
}

function normalizeStatus(value: unknown): WalletReservationStatus {
	const status = String(value ?? "").trim().toLowerCase();
	if (
		status === "held" ||
		status === "captured" ||
		status === "released" ||
		status === "insufficient_funds" ||
		status === "insufficient_balance" ||
		status === "daily_request_limit_reached" ||
		status === "weekly_request_limit_reached" ||
		status === "monthly_request_limit_reached" ||
		status === "daily_cost_limit_reached" ||
		status === "weekly_cost_limit_reached" ||
		status === "monthly_cost_limit_reached" ||
		status === "key_limit_soft_blocked" ||
		status === "key_not_found" ||
		status === "key_not_active" ||
		status === "key_wrong_workspace" ||
		status === "reserved_balance_mismatch" ||
		status === "reservation_exceeded" ||
		status === "not_found"
	) {
		return status;
	}
	return "unknown";
}

function toFinite(value: unknown): number | null {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function normalizeResult(data: unknown, successStatus?: "held" | "captured" | "released"): WalletReservationResult | null {
	const row = (Array.isArray(data) ? data[0] : data) as WalletReservationRpcRow | null | undefined;
	if (!row || typeof row !== "object") return null;
	const explicitStatus = normalizeStatus(row.status);
	const reason = String(row.reason ?? "").trim().toLowerCase();
	const inferredStatus = explicitStatus !== "unknown"
		? explicitStatus
		: reason === "already_reserved" || (successStatus === "held" && row.ok === true)
			? "held"
			: reason === "already_captured" || (successStatus === "captured" && row.ok === true)
				? "captured"
				: reason === "already_released" || (successStatus === "released" && row.ok === true)
					? "released"
					: reason === "reservation_exceeded"
						? "reservation_exceeded"
						: normalizeStatus(reason);
	return {
		applied: row.applied === true,
		alreadyApplied:
			row.already_applied === true ||
			reason === "already_reserved" ||
			reason === "already_captured" ||
			reason === "already_released",
		status: inferredStatus,
		amountNanos: Math.max(0, Number(row.amount_nanos ?? 0) || 0),
		beforeBalanceNanos: toFinite(row.before_balance_nanos),
		afterBalanceNanos: toFinite(row.after_balance_nanos),
		beforeReservedNanos: toFinite(row.before_reserved_nanos),
		afterReservedNanos: toFinite(row.after_reserved_nanos),
	};
}

export async function reserveWalletCredits(args: {
	workspaceId: string;
	reservationId: string;
	amountNanos: number;
	holdRefId?: string | null;
	keyId?: string | null;
	requestCount?: number | null;
}): Promise<WalletReservationResult> {
	const data = await walletReservationRepository.reserve({
		workspaceId: args.workspaceId,
		reservationId: args.reservationId,
		amountNanos: Math.max(0, Math.trunc(args.amountNanos)),
		holdRefId: args.holdRefId ?? null,
		keyId: args.keyId ?? null,
		requestCount: args.requestCount == null ? null : Math.max(0, Math.trunc(args.requestCount)),
	});
	const normalized = normalizeResult(data, "held") ?? {
		applied: false,
		alreadyApplied: false,
		status: "unknown",
		amountNanos: Math.max(0, Math.trunc(args.amountNanos)),
		beforeBalanceNanos: null,
		afterBalanceNanos: null,
		beforeReservedNanos: null,
		afterReservedNanos: null,
	};
	if (normalized.applied || normalized.alreadyApplied) await invalidateReservationCaches(args.workspaceId, args.keyId);
	return normalized;
}

export async function captureWalletReservation(args: {
	workspaceId: string;
	reservationId: string;
	captureRefId?: string | null;
	keyId?: string | null;
}): Promise<WalletReservationResult> {
	const data = await walletReservationRepository.capture({
		workspaceId: args.workspaceId,
		reservationId: args.reservationId,
		captureRefId: args.captureRefId ?? null,
	});
	const normalized = normalizeResult(data, "captured") ?? {
		applied: false,
		alreadyApplied: false,
		status: "unknown",
		amountNanos: 0,
		beforeBalanceNanos: null,
		afterBalanceNanos: null,
		beforeReservedNanos: null,
		afterReservedNanos: null,
	};
	if (normalized.applied || normalized.alreadyApplied) await invalidateReservationCaches(args.workspaceId, args.keyId);
	return normalized;
}

export async function releaseWalletReservation(args: {
	workspaceId: string;
	reservationId: string;
	releaseRefId?: string | null;
	keyId?: string | null;
}): Promise<WalletReservationResult> {
	const data = await walletReservationRepository.release({
		workspaceId: args.workspaceId,
		reservationId: args.reservationId,
		releaseRefId: args.releaseRefId ?? null,
	});
	const normalized = normalizeResult(data, "released") ?? {
		applied: false,
		alreadyApplied: false,
		status: "unknown",
		amountNanos: 0,
		beforeBalanceNanos: null,
		afterBalanceNanos: null,
		beforeReservedNanos: null,
		afterReservedNanos: null,
	};
	if (normalized.applied || normalized.alreadyApplied) await invalidateReservationCaches(args.workspaceId, args.keyId);
	return normalized;
}

export async function settleWalletReservation(args: {
	workspaceId: string;
	reservationId: string;
	actualNanos: number;
	settleRefId?: string | null;
	keyId?: string | null;
}): Promise<WalletReservationResult> {
	const data = await walletReservationRepository.settle({
		workspaceId: args.workspaceId,
		reservationId: args.reservationId,
		actualNanos: Math.max(0, Math.trunc(args.actualNanos)),
		settleRefId: args.settleRefId ?? null,
	});
	const normalized = normalizeResult(data, "captured") ?? {
		applied: false,
		alreadyApplied: false,
		status: "unknown",
		amountNanos: Math.max(0, Math.trunc(args.actualNanos)),
		beforeBalanceNanos: null,
		afterBalanceNanos: null,
		beforeReservedNanos: null,
		afterReservedNanos: null,
	};
	if (normalized.applied || normalized.alreadyApplied) await invalidateReservationCaches(args.workspaceId, args.keyId);
	return normalized;
}

export async function releaseStaleOrphanBatchReservations(args?: {
	olderThanSeconds?: number;
	limit?: number;
}): Promise<number> {
	const released = Number(await walletReservationRepository.releaseStaleOrphanBatches(
		Math.max(300, Math.trunc(args?.olderThanSeconds ?? 1_800)),
		Math.max(1, Math.min(1_000, Math.trunc(args?.limit ?? 100))),
	));
	if (!Number.isFinite(released) || released < 0) throw new Error("invalid_stale_batch_reservation_release_result");
	return Math.trunc(released);
}
