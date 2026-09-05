import { resolveDefaultGatewayStatuses } from "./defaultGatewayStatuses";

describe("resolveDefaultGatewayStatuses", () => {
	it("keeps the public models view limited to active Gateway routes by default", () => {
		expect(resolveDefaultGatewayStatuses([], false)).toEqual(["active"]);
	});

	it("preserves an explicit status selection", () => {
		expect(resolveDefaultGatewayStatuses(["coming_soon"], true)).toEqual([
			"coming_soon",
		]);
	});

	it("allows all statuses after the user explicitly clears the filter", () => {
		expect(resolveDefaultGatewayStatuses([], true)).toEqual([]);
	});
});
