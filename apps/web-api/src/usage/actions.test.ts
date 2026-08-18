import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	loadUsageRequestPage: vi.fn(),
}));

vi.mock("@/repositories/usage-observability", () => ({
	getUsageMetadata: vi.fn(),
	loadAsyncJobDetail: vi.fn(),
	loadFunStatsRows: vi.fn(),
	loadRecentJobs: vi.fn(),
	loadRequestInvestigation: vi.fn(),
	loadSessionRequests: vi.fn(),
	loadUsageRequestPage: mocks.loadUsageRequestPage,
}));

vi.mock("@/repositories/usage-rollups", () => ({
	getJobsRollup: vi.fn(),
	getSessionRollups: vi.fn(),
	getUsageChartRollup: vi.fn(),
}));

import {
	fetchPaginatedRequests,
	runWithUsageContext,
} from "@/usage/actions";

describe("fetchPaginatedRequests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.loadUsageRequestPage.mockResolvedValue(
			Array.from({ length: 26 }, (_, index) => ({
				id: `row-${26 - index}`,
				request_id: `request-${26 - index}`,
				created_at: new Date(Date.parse("2026-08-18T10:00:00.000Z") - index * 1_000).toISOString(),
			})),
		);
	});

	it("passes the keyset cursor and normalized filters to the repository", async () => {
		const cursor = { createdAt: "2026-08-18T10:01:00.000Z", id: "00000000-0000-0000-0000-000000000003" };
		const result = await runWithUsageContext(
			{ account: { workspaceId: "workspace-1" } as never, env: {} as never },
			() => fetchPaginatedRequests({
				pageSize: 25,
				cursor,
				timeRange: { from: "2026-08-17T10:00:00.000Z", to: "2026-08-18T10:00:00.000Z" },
				modelFilter: "openai/gpt-test",
				statusCodeFilter: 429,
				inputTokensFilter: "100",
				inputTokensOperator: "gte",
				filterOperators: { model: "is", http: "is_not" },
			}),
		);

		expect(mocks.loadUsageRequestPage).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				workspaceId: "workspace-1",
				cursor,
				limit: 25,
				stringFilters: [
					{ column: "model", value: "openai/gpt-test", negate: false },
					{ column: "statusCode", value: "429", negate: true },
				],
				tokenFilters: [{ column: "input", operator: "gte", value: 100 }],
			}),
		);
		expect(result).toMatchObject({
			hasMore: true,
			nextCursor: { createdAt: "2026-08-18T09:59:36.000Z", id: "row-2" },
		});
	});

	it.each([
		{ createdAt: "2026-08-18T10:01:00.000Z", id: "not-a-uuid" },
		{ createdAt: "not-a-date", id: "00000000-0000-0000-0000-000000000003" },
	])("rejects a malformed cursor before querying the database", async (cursor) => {
		await expect(runWithUsageContext(
			{ account: { workspaceId: "workspace-1" } as never, env: {} as never },
			() => fetchPaginatedRequests({ cursor }),
		)).rejects.toThrow("Invalid request cursor");
		expect(mocks.loadUsageRequestPage).not.toHaveBeenCalled();
	});
});
