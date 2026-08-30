import { resolveEnforcedZdr } from "./zdr";

describe("resolveEnforcedZdr", () => {
	it("does not promote contractual eligibility into an active retention guarantee", () => {
		expect(resolveEnforcedZdr(false, "eligible")).toBe(false);
		expect(resolveEnforcedZdr(null, "eligible")).toBeNull();
	});

	it("preserves explicit guarantees and ineligibility", () => {
		expect(resolveEnforcedZdr(true, "eligible")).toBe(true);
		expect(resolveEnforcedZdr(true, "ineligible")).toBe(false);
		expect(resolveEnforcedZdr(true, "unknown")).toBe(true);
	});
});
