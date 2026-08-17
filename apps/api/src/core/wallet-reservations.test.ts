import { beforeEach, describe, expect, it, vi } from "vitest";

const reserveMock = vi.fn();
const captureMock = vi.fn();
const releaseMock = vi.fn();
const settleMock = vi.fn();
const releaseStaleMock = vi.fn();
const invalidateGatewayCreditCacheMock = vi.fn();
const setKeyVersionMock = vi.fn();

vi.mock("@/runtime/env", () => ({
	getBindings: () => ({}),
}));

vi.mock("@/repositories/wallet-reservations", () => ({
	reserve: (...args: unknown[]) => reserveMock(...args),
	capture: (...args: unknown[]) => captureMock(...args),
	release: (...args: unknown[]) => releaseMock(...args),
	settle: (...args: unknown[]) => settleMock(...args),
	releaseStaleOrphanBatches: (...args: unknown[]) => releaseStaleMock(...args),
}));

vi.mock("@core/gateway-credit-cache", () => ({
	invalidateGatewayCreditCache: (...args: unknown[]) => invalidateGatewayCreditCacheMock(...args),
}));

vi.mock("@core/kv", () => ({
	setKeyVersion: (...args: unknown[]) => setKeyVersionMock(...args),
}));

import {
	captureWalletReservation,
	releaseWalletReservation,
	releaseStaleOrphanBatchReservations,
	reserveWalletCredits,
	settleWalletReservation,
} from "./wallet-reservations";

describe("wallet reservation repository integration", () => {
	beforeEach(() => {
		reserveMock.mockReset();
		captureMock.mockReset();
		releaseMock.mockReset();
		settleMock.mockReset();
		releaseStaleMock.mockReset();
		invalidateGatewayCreditCacheMock.mockReset();
		setKeyVersionMock.mockReset();
	});

	it("passes reservation identity and key limits to the repository", async () => {
		reserveMock.mockResolvedValueOnce({
						applied: true,
						ok: true,
						reason: null,
						amount_nanos: 150000000,
						before_balance_nanos: 500000000,
						after_balance_nanos: 500000000,
						before_reserved_nanos: 0,
						after_reserved_nanos: 150000000,
					});

		const result = await reserveWalletCredits({
			workspaceId: "6108396e-0e12-425d-91ff-a02d39a346e0",
			reservationId: "video_reservation:req_123",
			amountNanos: 150000000,
			holdRefId: "req_123",
			keyId: "key_123",
			requestCount: 2,
		});

		expect(result.status).toBe("held");
		expect(result.applied).toBe(true);
		expect(reserveMock).toHaveBeenCalledWith({
			workspaceId: "6108396e-0e12-425d-91ff-a02d39a346e0",
			reservationId: "video_reservation:req_123",
			amountNanos: 150000000,
			holdRefId: "req_123",
			keyId: "key_123",
			requestCount: 2,
		});
		expect(invalidateGatewayCreditCacheMock).toHaveBeenCalledWith("6108396e-0e12-425d-91ff-a02d39a346e0");
		expect(setKeyVersionMock).toHaveBeenCalledWith("id", "key_123", expect.any(Number));
	});

	it("normalizes current wallet reservation RPC ok/reason rows", async () => {
		reserveMock.mockResolvedValueOnce({
					ok: true,
					applied: true,
					reason: null,
					amount_nanos: 5_000_000_000,
					before_balance_nanos: 10_000_000_000,
					after_balance_nanos: 10_000_000_000,
					before_reserved_nanos: 0,
					after_reserved_nanos: 5_000_000_000,
		});

		await expect(
			reserveWalletCredits({
				workspaceId: "6108396e-0e12-425d-91ff-a02d39a346e0",
				reservationId: "rt:req_123",
				amountNanos: 5_000_000_000,
				holdRefId: "req_123",
			}),
		).resolves.toMatchObject({
			applied: true,
			status: "held",
			amountNanos: 5_000_000_000,
			afterReservedNanos: 5_000_000_000,
		});
	});

	it("normalizes current wallet reservation RPC failure reasons", async () => {
		reserveMock.mockResolvedValueOnce({
					ok: false,
					applied: false,
					reason: "insufficient_balance",
					amount_nanos: 5_000_000_000,
		});

		await expect(
			reserveWalletCredits({
				workspaceId: "6108396e-0e12-425d-91ff-a02d39a346e0",
				reservationId: "rt:req_124",
				amountNanos: 5_000_000_000,
				holdRefId: "req_124",
			}),
		).resolves.toMatchObject({
			applied: false,
			status: "insufficient_balance",
		});
	});

	it("passes capture and release transitions to the repository", async () => {
		captureMock.mockResolvedValueOnce({ ok: true, applied: true, reason: null, amount_nanos: 150000000 });
		releaseMock.mockResolvedValueOnce({ ok: true, applied: true, reason: null, amount_nanos: 150000000 });

		const workspaceId = "6108396e-0e12-425d-91ff-a02d39a346e0";
		await expect(
			captureWalletReservation({
				workspaceId,
				reservationId: "video_reservation:req_123",
				captureRefId: "req_123",
			}),
		).resolves.toMatchObject({ status: "captured" });
		await expect(
			releaseWalletReservation({
				workspaceId,
				reservationId: "video_reservation:req_124",
				releaseRefId: "req_124",
			}),
		).resolves.toMatchObject({ status: "released" });

		expect(captureMock).toHaveBeenCalledWith({ workspaceId, reservationId: "video_reservation:req_123", captureRefId: "req_123" });
		expect(releaseMock).toHaveBeenCalledWith({ workspaceId, reservationId: "video_reservation:req_124", releaseRefId: "req_124" });
	});

	it("normalizes current reservation RPC shapes and settles an exact batch cost", async () => {
		reserveMock.mockResolvedValueOnce({ ok: true, applied: true, reason: null, amount_nanos: 500 });
		settleMock.mockResolvedValueOnce({ ok: true, applied: true, reason: null, amount_nanos: 320 });
		await expect(reserveWalletCredits({
			workspaceId: "ws_1",
			reservationId: "batch_hold:req_1",
			amountNanos: 500,
		})).resolves.toMatchObject({ status: "held", applied: true });
		await expect(settleWalletReservation({
			workspaceId: "ws_1",
			reservationId: "batch_hold:req_1",
			actualNanos: 320,
			settleRefId: "batch_1",
		})).resolves.toMatchObject({ status: "captured", applied: true, amountNanos: 320 });
		expect(settleMock).toHaveBeenCalledWith({
			workspaceId: "ws_1",
			reservationId: "batch_hold:req_1",
			actualNanos: 320,
			settleRefId: "batch_1",
		});
		expect(invalidateGatewayCreditCacheMock).toHaveBeenCalledTimes(2);
	});

	it("invalidates caches when an idempotent retry reports an already-applied transition", async () => {
		reserveMock.mockResolvedValueOnce({ ok: true, applied: false, already_applied: false, reason: "already_reserved", amount_nanos: 500 });
		await expect(reserveWalletCredits({
			workspaceId: "ws_retry",
			reservationId: "batch_hold:req_retry",
			amountNanos: 500,
			keyId: "key_retry",
		})).resolves.toMatchObject({ status: "held", alreadyApplied: true });
		expect(invalidateGatewayCreditCacheMock).toHaveBeenCalledWith("ws_retry");
		expect(setKeyVersionMock).toHaveBeenCalledWith("id", "key_retry", expect.any(Number));
	});

	it("releases stale orphan batch holds through the bounded repository reaper", async () => {
		releaseStaleMock.mockResolvedValueOnce(3);
		await expect(releaseStaleOrphanBatchReservations({ olderThanSeconds: 60, limit: 5000 })).resolves.toBe(3);
		expect(releaseStaleMock).toHaveBeenCalledWith(300, 1000);
	});
});
