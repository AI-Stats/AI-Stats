import { describe, expect, it } from "vitest";
import { requestIdFor } from "./request-id";

describe("requestIdFor", () => {
	it("reuses one generated ID for the same request", () => {
		const request = new Request("https://api.phaseo.app/v1/models");
		expect(requestIdFor(request)).toBe(requestIdFor(request));
	});

	it("preserves a safe supplied ID", () => {
		const request = new Request("https://api.phaseo.app/v1/models", { headers: { "x-request-id": "browser-request-123" } });
		expect(requestIdFor(request)).toBe("browser-request-123");
	});

	it("rejects unsafe supplied IDs", () => {
		const request = new Request("https://api.phaseo.app/v1/models", { headers: { "x-request-id": "unsafe request id" } });
		expect(requestIdFor(request)).not.toBe("unsafe request id");
	});
});
