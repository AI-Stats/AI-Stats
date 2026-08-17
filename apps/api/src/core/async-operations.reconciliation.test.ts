import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
	claimOperationsForReconciliation: vi.fn(),
	updateReconciliation: vi.fn(),
}));

vi.mock("@/repositories/async-operations", () => repository);

import { claimAsyncOperationsForReconciliation, updateAsyncOperationReconciliation } from "./async-operations";

describe("async operation reconciliation storage", () => {
	beforeEach(() => vi.clearAllMocks());

	it("claims due operations through the transactional Drizzle repository", async () => {
		repository.claimOperationsForReconciliation.mockResolvedValue([{
			workspace_id: "team_1", kind: "video", internal_id: "vid_1", request_id: "req_1", session_id: null,
			app_id: null, provider: "openai", native_id: "native_vid_1", model: "sora-2", status: "in_progress",
			meta: { provider: "openai" }, billed_at: null, next_reconcile_at: "2026-06-17T10:00:00.000Z",
			reconcile_attempts: 2, reconcile_locked_at: "2026-06-17T10:00:01.000Z", reconcile_locked_by: "worker-1",
			last_reconcile_error: null, created_at: "2026-06-17T09:59:00.000Z", updated_at: "2026-06-17T10:00:01.000Z",
		}]);

		const records = await claimAsyncOperationsForReconciliation({ kind: "video", limit: 5000, statuses: [null, "in_progress", "in_progress"], workerId: "worker-1", leaseSeconds: 5, shardCount: 999, shardIndex: 500 });

		expect(repository.claimOperationsForReconciliation).toHaveBeenCalledWith({ kind: "video", limit: 2000, statuses: ["", "in_progress"], workerId: "worker-1", leaseSeconds: 30, shardCount: 256, shardIndex: 255 });
		expect(records).toEqual([expect.objectContaining({ workspaceId: "team_1", internalId: "vid_1", reconcileAttempts: 2, reconcileLockedBy: "worker-1" })]);
	});

	it("releases a reconciliation lease and schedules the next attempt", async () => {
		await updateAsyncOperationReconciliation({ workspaceId: "team_1", kind: "batch", internalId: "batch_1", nextReconcileAt: "2026-06-17T10:05:00.000Z", lastError: null });
		expect(repository.updateReconciliation).toHaveBeenCalledWith({ workspaceId: "team_1", kind: "batch", internalId: "batch_1", nextReconcileAt: "2026-06-17T10:05:00.000Z", lastError: null, clearLease: true });
	});
});
