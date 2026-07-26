import {
	extractDiscoveryLimits,
	mergeSimplePricing,
	safePricingRules,
} from "./sync-provider-discovery";
import { mergeModelsDevPricing, modelsDevMeters } from "./enrich-models-dev";

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
});

describe("models.dev pricing enrichment", () => {
	test("maps per-million token costs to Phaseo meters", () => {
		expect(modelsDevMeters({
			cost: { input: 1, output: 5, cache_read: 0.1 },
		})).toEqual({
			input_text_tokens: 1,
			cached_read_text_tokens: 0.1,
			output_text_tokens: 5,
		});
	});

	test("does not overwrite conditional pricing", () => {
		const pricing = {
			rules: [{ pricing_plan: "standard", match: [{ path: "input_tokens", op: "gte", value: 200_000 }] }],
		};
		expect(mergeModelsDevPricing(pricing, { input_text_tokens: 1 }, "2026-07-26T00:00:00Z")).toBe(false);
	});
});
