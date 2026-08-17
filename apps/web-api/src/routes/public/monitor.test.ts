import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/repositories/monitor", () => ({
	getMonitorHistory: vi.fn(async () => ({ summary: { total_commits: 3, total_changes: 7, last_sha: "abc" }, rows: [{ event_id: "event-1", committed_at: "2026-07-17", provider_kind: "model", model_id: "openai/gpt-test", field: "status", action: "changed" }] })),
	listMonitorFilterOptions: vi.fn(async () => []),
}));
import app from "@/index";
const env = { ENV: "development" as const };
afterEach(() => vi.clearAllMocks());

describe("public monitor history", () => {
	it("returns compact paged history through a parameterized Worker route", async () => {
		const response = await app.request("https://phaseo.app/api/_web/monitor/history?commit_limit=2&commit_offset=0", {}, env);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-tag")).toBe("web-api-monitor-history");
		const payload = await response.json() as { hasMore: boolean; nextCommitOffset: number; totalChanges: number; entries: unknown[][] };
		expect(payload).toMatchObject({ hasMore: true, nextCommitOffset: 2, totalChanges: 7 });
		expect(payload.entries[0]?.slice(0, 4)).toEqual(["event-1", "2026-07-17", "model", "openai/gpt-test"]);
	});
});
