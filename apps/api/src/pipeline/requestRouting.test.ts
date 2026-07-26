import { describe, expect, it } from "vitest";
import {
	applyResidencyPolicyFloor,
	getEffectiveRoutingHints,
} from "./requestRouting";

describe("regional routing hints", () => {
	it("expands provider.region to execution and data requirements", () => {
		const hints = getEffectiveRoutingHints({ provider: { region: " EU " } });

		expect(hints.requiredExecutionRegion).toBe("eu");
		expect(hints.requiredDataRegion).toBe("eu");
	});

	it("keeps explicit requirements more specific than the shorthand", () => {
		const hints = getEffectiveRoutingHints({
			provider: {
				region: "eu",
				required_data_region: "de",
			},
		});

		expect(hints.requiredExecutionRegion).toBe("eu");
		expect(hints.requiredDataRegion).toBe("de");
	});

	it("injects the EU content-path floor when no request preference exists", () => {
		const result = applyResidencyPolicyFloor(
			{ model: "example/model", provider: { allow_fallbacks: true } },
			{ region: "eu", source: "eu_content_path" },
		);

		expect(result).toMatchObject({
			ok: true,
			body: {
				routing: {
					required_execution_region: "eu",
					required_data_region: "eu",
				},
			},
		});
	});

	it("rejects requests that try to weaken the EU content-path floor", () => {
		const result = applyResidencyPolicyFloor(
			{ provider: { region: "us" } },
			{ region: "eu", source: "eu_content_path" },
		);

		expect(result).toEqual({
			ok: false,
			conflicts: [
				{
					field: "required_execution_region",
					requested: "us",
					required: "eu",
				},
				{
					field: "required_data_region",
					requested: "us",
					required: "eu",
				},
			],
		});
	});
});
