import { beforeEach, describe, expect, it, vi } from "vitest";

type AsyncOperationRow = Record<string, unknown>;

function percentile(values: number[], p: number): number {
	const sorted = values.slice().sort((a, b) => a - b);
	return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

const runtime = vi.hoisted(() => ({
	row: null as AsyncOperationRow | null,
	findOperation: vi.fn(async () => runtime.row),
	upsertOperation: vi.fn(async (payload: Record<string, unknown>) => {
		runtime.row = {
			...runtime.row,
			workspace_id: payload.workspaceId,
			kind: payload.kind,
			internal_id: payload.internalId,
			request_id: payload.requestId ?? null,
			session_id: payload.sessionId ?? null,
			provider: payload.provider ?? null,
			native_id: payload.nativeId ?? null,
			model: payload.model ?? null,
			status: payload.status ?? null,
			meta: payload.meta ?? {},
			updated_at: payload.updatedAt,
		};
	}),
}));

vi.mock("@/repositories/async-operations", () => ({
	findOperation: runtime.findOperation,
	upsertOperation: runtime.upsertOperation,
}));

const { __resetAsyncOperationCachesForTests, getAsyncOperation, upsertAsyncOperation } = await import("@/core/async-operations");

describe("async operations warm-cache performance", () => {
	beforeEach(() => {
		runtime.row = {
			workspace_id: "team_async_perf", kind: "video", internal_id: "video_123",
			request_id: "req_async_123", session_id: "session_async_123", app_id: null,
			provider: "openai", native_id: "native_async_123", model: "openai/sora-2",
			status: "queued", meta: { provider: "openai", requestId: "req_async_123" },
			billed_at: null, created_at: "2026-05-05T10:00:00.000Z", updated_at: "2026-05-05T10:00:00.000Z",
		};
		runtime.findOperation.mockClear();
		runtime.upsertOperation.mockClear();
		__resetAsyncOperationCachesForTests();
	});

	it("deduplicates concurrent cold point reads to one Drizzle repository lookup", async () => {
		const calls = await Promise.all(Array.from({ length: 3 }, () => getAsyncOperation("team_async_perf", "video", "video_123")));
		expect(calls.map((row) => row?.internalId)).toEqual(["video_123", "video_123", "video_123"]);
		expect(runtime.findOperation).toHaveBeenCalledTimes(1);
	});

	it("keeps warm point reads under 5ms p95 with no extra database lookups", async () => {
		expect((await getAsyncOperation("team_async_perf", "video", "video_123"))?.status).toBe("queued");
		runtime.findOperation.mockClear();
		const samples: number[] = [];
		for (let index = 0; index < 300; index += 1) {
			const started = performance.now();
			expect((await getAsyncOperation("team_async_perf", "video", "video_123"))?.status).toBe("queued");
			samples.push(performance.now() - started);
		}
		expect(percentile(samples, 95)).toBeLessThan(5);
		expect(runtime.findOperation).not.toHaveBeenCalled();
	});

	it("invalidates the point-read cache after a Drizzle upsert", async () => {
		expect((await getAsyncOperation("team_async_perf", "video", "video_123"))?.status).toBe("queued");
		runtime.findOperation.mockClear();
		await upsertAsyncOperation({
			workspaceId: "team_async_perf", kind: "video", internalId: "video_123",
			requestId: "req_async_123", sessionId: "session_async_123", provider: "openai",
			nativeId: "native_async_123", model: "openai/sora-2", status: "completed",
			meta: { provider: "openai", requestId: "req_async_123", finalizedAt: "2026-05-05T10:01:00.000Z" },
		});
		const refreshed = await getAsyncOperation("team_async_perf", "video", "video_123");
		expect(refreshed?.status).toBe("completed");
		expect(refreshed?.meta.finalizedAt).toBe("2026-05-05T10:01:00.000Z");
		expect(runtime.findOperation).toHaveBeenCalledTimes(1);
	});
});
