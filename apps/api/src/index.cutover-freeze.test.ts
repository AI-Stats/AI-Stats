import { describe, expect, it, vi } from "vitest";
import worker from "./index";

describe("gateway cutover freeze", () => {
	it("rejects external writes and allows reads", async () => {
		const env = { CUTOVER_WRITE_FREEZE: "true" } as any;
		const write = await worker.fetch(new Request("https://api.phaseo.app/v1/chat/completions", { method: "POST" }), env, {} as any);
		expect(write.status).toBe(503);
		expect(write.headers.get("retry-after")).toBe("60");

		const read = await worker.fetch(new Request("https://api.phaseo.app/health", { method: "GET" }), env, {} as any);
		expect(read.status).not.toBe(503);
	});

	it("does not run scheduled writers while frozen", async () => {
		const waitUntil = vi.fn();
		await worker.scheduled({ scheduledTime: Date.now(), cron: "* * * * *", noRetry: vi.fn() } as any, { CUTOVER_WRITE_FREEZE: "true" } as any, { waitUntil } as any);
		expect(waitUntil).not.toHaveBeenCalled();
	});
});
