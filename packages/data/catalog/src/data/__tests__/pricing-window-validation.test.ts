import { describe, expect, test } from "vitest";
import { checkPricingEntrySafety, isMajorError } from "../validate";

describe("pricing window validation", () => {
	test("requires rule windows to match top-level windows", () => {
		const base = {
			key: "p:m:e",
			api_provider_id: "p",
			model_id: "m",
			endpoint: "e",
			effective_to: "2026-05-23T00:00:00Z",
			rules: [
				{
					meter: "input_text_tokens",
					unit_size: 1,
					price_per_unit: 0.0025,
				},
			],
		};

		for (const pricing of [
			base,
			{
				...base,
				rules: [{ ...base.rules[0], effective_to: "2026-05-24T00:00:00Z" }],
			},
		]) {
			const errors = checkPricingEntrySafety(pricing);
			expect(errors).toEqual(
				expect.arrayContaining([
					expect.stringContaining("rule effective_to must match top-level effective_to"),
				]),
			);
			expect(errors.some(isMajorError)).toBe(true);
		}
	});
});
