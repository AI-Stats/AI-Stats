import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertBatchRequestRowsMock = vi.fn();
const findBatchRequestRowsMock = vi.fn();

vi.mock("@/repositories/batch-requests", () => ({
	upsertBatchRequestRows: (...args: unknown[]) => upsertBatchRequestRowsMock(...args),
	findBatchRequestRows: (...args: unknown[]) => findBatchRequestRowsMock(...args),
}));

import { listBatchRequestRows, saveBatchRequestRows } from "./batch-requests";

describe("batch request persistence", () => {
	beforeEach(() => {
		upsertBatchRequestRowsMock.mockReset();
		findBatchRequestRowsMock.mockReset();
	});

	it("writes typed Drizzle-shaped rows", async () => {
		upsertBatchRequestRowsMock.mockResolvedValue(undefined);
		await saveBatchRequestRows({
			workspaceId: "workspace-1",
			batchId: "batch-1",
			rows: [{
				provider: "openai",
				customId: "request-1",
				requestIndex: 3,
				costUsd: 1.25,
				responseBody: { ok: true },
			}],
		});

		expect(upsertBatchRequestRowsMock).toHaveBeenCalledWith([expect.objectContaining({
			workspaceId: "workspace-1",
			batchId: "batch-1",
			customId: "request-1",
			requestIndex: 3,
			costUsd: "1.25",
			responseBody: { ok: true },
		})]);
	});

	it("bounds pagination, filters in the repository, and maps numeric values", async () => {
		findBatchRequestRowsMock.mockResolvedValue([{
			id: "row-1",
			workspaceId: "workspace-1",
			batchId: "batch-1",
			provider: "openai",
			nativeBatchId: null,
			customId: "request-1",
			requestIndex: 0,
			method: "POST",
			endpoint: "/v1/chat/completions",
			model: "model-1",
			status: "completed",
			requestBodyHash: null,
			responseStatus: 200,
			responseBody: { ok: true },
			errorBody: null,
			usage: { input_tokens: 4 },
			costNanos: 25,
			costUsd: "0.000000025",
			meta: {},
			createdAt: "2026-08-16T10:00:00.000Z",
			updatedAt: "2026-08-16T10:01:00.000Z",
			completedAt: "2026-08-16T10:01:00.000Z",
		}]);

		const rows = await listBatchRequestRows({
			workspaceId: "workspace-1",
			batchId: "batch-1",
			limit: 5000,
			offset: -4,
			status: " completed ",
		});

		expect(findBatchRequestRowsMock).toHaveBeenCalledWith({
			workspaceId: "workspace-1",
			batchId: "batch-1",
			limit: 1000,
			offset: 0,
			status: "completed",
		});
		expect(rows[0]?.costUsd).toBe(0.000000025);
		expect(rows[0]?.responseStatus).toBe(200);
	});
});
