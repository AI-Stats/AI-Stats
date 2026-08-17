import { describe, expect, it } from "vitest";
import { isCutoverWriteFreezeEnabled } from "./cutover-freeze";

describe("isCutoverWriteFreezeEnabled", () => {
	it("requires an explicit true value", () => {
		expect(isCutoverWriteFreezeEnabled({ CUTOVER_WRITE_FREEZE: "true" })).toBe(true);
		expect(isCutoverWriteFreezeEnabled({ CUTOVER_WRITE_FREEZE: " TRUE " })).toBe(true);
		expect(isCutoverWriteFreezeEnabled({ CUTOVER_WRITE_FREEZE: "false" })).toBe(false);
		expect(isCutoverWriteFreezeEnabled({})).toBe(false);
	});
});
