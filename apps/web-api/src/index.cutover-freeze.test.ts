import { describe, expect, it } from "vitest";
import app from "./index";

describe("web API cutover freeze", () => {
	it("rejects writes and allows reads", async () => {
		const env = { CUTOVER_WRITE_FREEZE: "true", ENV: "production" } as any;
		const write = await app.request("/api/chat/completions", { method: "POST" }, env);
		expect(write.status).toBe(503);
		expect(write.headers.get("retry-after")).toBe("60");

		const read = await app.request("/does-not-exist", { method: "GET" }, env);
		expect(read.status).not.toBe(503);
	});
});
