import { describe, expect, it } from "vitest";
import { waferQuirks } from "../../providers/wafer/quirks";

describe("Wafer quirks", () => {
	it("does not forward Phaseo service tiers upstream", () => {
		const request: Record<string, unknown> = { service_tier: "priority" };
		waferQuirks.transformRequest?.({ request, ir: {} as any });
		expect(request.service_tier).toBeUndefined();
	});
});
