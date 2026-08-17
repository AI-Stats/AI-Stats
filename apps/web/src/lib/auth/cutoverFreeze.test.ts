import { shouldBlockDuringCutover } from "./cutoverFreeze";

describe("shouldBlockDuringCutover", () => {
	it("blocks writes only when explicitly frozen", () => {
		expect(shouldBlockDuringCutover("POST", "/settings", "true")).toBe(true);
		expect(shouldBlockDuringCutover("POST", "/settings", "false")).toBe(false);
		expect(shouldBlockDuringCutover("GET", "/models", "true")).toBe(false);
	});

	it("blocks Better Auth callbacks while preserving session reads", () => {
		expect(shouldBlockDuringCutover("GET", "/api/auth/callback/google", "true")).toBe(true);
		expect(shouldBlockDuringCutover("GET", "/api/auth/get-session", "true")).toBe(false);
	});
});
