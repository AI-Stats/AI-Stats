import {
	extractDiscoveryLimits,
	mergeSimplePricing,
	safePricingRules,
} from "./sync-provider-discovery";

describe("provider discovery catalog sync", () => {
	test("extracts nested provider limits", () => {
		expect(extractDiscoveryLimits({
			metadata: { context_length: 200_000, max_output_tokens: 16_384 },
		})).toEqual({ context: 200_000, output: 16_384 });
	});

	test("updates and adds meters only for simple standard pricing", () => {
		const pricing = {
			rules: [{
				meter: "input_text_tokens",
				pricing_plan: "standard",
				price_per_unit: 1,
				match: [],
				conditions: [],
				effective_to: null,
			}],
		};
		const result = mergeSimplePricing(pricing, {
			input_text_tokens: 2,
			output_text_tokens: 8,
		});
		expect(result.changed).toBe(true);
		expect(result.value.rules).toEqual(expect.arrayContaining([
			expect.objectContaining({ meter: "input_text_tokens", price_per_unit: 2 }),
			expect.objectContaining({ meter: "output_text_tokens", price_per_unit: 8 }),
		]));
	});

	test("rejects conditional pricing from automatic mutation", () => {
		expect(safePricingRules({
			rules: [{ pricing_plan: "standard", match: [{ path: "input_tokens", op: "gte", value: 200_000 }] }],
		})).toBe(false);
	});

	test("rejects multiple active rules for the same meter", () => {
		expect(safePricingRules({
			rules: [
				{ meter: "input_text_tokens", pricing_plan: "standard", match: [], conditions: [] },
				{ meter: "input_text_tokens", pricing_plan: "standard", match: [], conditions: [], priority: 90 },
			],
		})).toBe(false);
	});
});
