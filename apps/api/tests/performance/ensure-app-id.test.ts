import { beforeEach, describe, expect, it, vi } from "vitest";

function percentile(values: number[], p: number): number {
	const sorted = values.slice().sort((a, b) => a - b);
	return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

const runtime = vi.hoisted(() => ({
	upsertLoggingApp: vi.fn(async () => "app_123"),
}));

vi.mock("@/repositories/apps", () => ({ upsertLoggingApp: runtime.upsertLoggingApp }));

const { __resetEnsureAppIdCacheForTests, ensureAppId } = await import("@/pipeline/after/apps");

describe("ensureAppId warm-cache performance", () => {
	beforeEach(() => {
		runtime.upsertLoggingApp.mockClear();
		__resetEnsureAppIdCacheForTests();
	});

	it("deduplicates concurrent cold app-id resolution to one Drizzle upsert", async () => {
		const args = { workspaceId: "team_perf_apps", referer: "https://example.com/app" };
		const [first, second, third] = await Promise.all([
			ensureAppId(args), ensureAppId(args), ensureAppId(args),
		]);
		expect([first, second, third]).toEqual(["app_123", "app_123", "app_123"]);
		expect(runtime.upsertLoggingApp).toHaveBeenCalledTimes(1);
	});

	it("keeps warm ensureAppId calls under 5ms p95 with no extra database work", async () => {
		const args = { workspaceId: "team_perf_apps", referer: "https://example.com/app" };
		expect(await ensureAppId(args)).toBe("app_123");
		runtime.upsertLoggingApp.mockClear();
		const samples: number[] = [];
		for (let index = 0; index < 300; index += 1) {
			const started = performance.now();
			expect(await ensureAppId(args)).toBe("app_123");
			samples.push(performance.now() - started);
		}
		expect(percentile(samples, 95)).toBeLessThan(5);
		expect(runtime.upsertLoggingApp).not.toHaveBeenCalled();
	});
});
