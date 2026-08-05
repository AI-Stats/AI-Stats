import {
	extractDiscoveryLimits,
	mergeSimplePricing,
	renderSyncMarkdown,
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

	test("renders official differences with model, capability, meter, and provenance", () => {
		const markdown = renderSyncMarkdown({
			providers: 1,
			rows: 1,
			mappingsCreated: 0,
			mappingsUpdated: 0,
			pricingCreated: 0,
			pricingUpdated: 1,
			unmatched: [],
			skippedPricing: [],
			changedFiles: [],
			officialPricing: {
				provider: "fireworks",
				sourceUrl: "https://example.com/pricing",
				rowsParsed: 1,
				pricingCreated: 0,
				pricingUpdated: 1,
				unmatched: [],
				ambiguous: [],
				skippedComplex: [],
				comparisons: [{
					providerModel: "Example",
					apiModelId: "example/model",
					capabilityId: "text.generate",
					meter: "cached_read_text_tokens",
					officialPrice: 0.028,
					currentPrices: [0.03],
					status: "different",
				}],
			},
		});
		expect(markdown).toContain("Official pricing source: https://example.com/pricing");
		expect(markdown).toContain("`example/model` `text.generate` `cached_read_text_tokens`");
		expect(markdown).toContain("official **$0.028/M**, current **$0.03/M** (different)");
	});
});
