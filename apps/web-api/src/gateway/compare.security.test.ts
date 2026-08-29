import { describe, expect, it } from "vitest";
import { isAllowedBenchmarkBaseUrl } from "./compare";

describe("benchmark credential origins", () => {
	it("binds each production credential to its own provider host", () => {
		expect(isAllowedBenchmarkBaseUrl("https://api.phaseo.app/v1", "phaseo")).toBe(true);
		expect(isAllowedBenchmarkBaseUrl("https://openrouter.ai/api/v1", "openrouter")).toBe(true);
		expect(isAllowedBenchmarkBaseUrl("https://openrouter.ai/api/v1", "phaseo")).toBe(false);
		expect(isAllowedBenchmarkBaseUrl("https://api.phaseo.app/v1", "openrouter")).toBe(false);
	});

	it.each([
		"https://user:secret@api.phaseo.app/v1",
		"https://api.phaseo.app:8443/v1",
		"http://api.phaseo.app/v1",
		"https://api.phaseo.app.evil.example/v1",
	])("rejects unsafe Phaseo benchmark URL %s", (value) => {
		expect(isAllowedBenchmarkBaseUrl(value, "phaseo")).toBe(false);
	});

	it("allows loopback only in explicit development mode", () => {
		expect(isAllowedBenchmarkBaseUrl("http://127.0.0.1/v1", "phaseo", false)).toBe(true);
		expect(isAllowedBenchmarkBaseUrl("http://127.0.0.1/v1", "phaseo", true)).toBe(false);
	});
});
