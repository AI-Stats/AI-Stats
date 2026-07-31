import { describe, expect, it } from "vitest";
import { isFreePriceCard } from "./free";

function card(rules: Array<{
	pricingPlan: string;
	pricePerUnit: string;
}>) {
	return {
		provider: "test-provider",
		model: "publisher/model:free",
		endpoint: "responses",
		effective_from: null,
		effective_to: null,
		currency: "USD",
		version: null,
		rules: rules.map((rule) => ({
			pricing_plan: rule.pricingPlan,
			meter: "input_tokens",
			unit: "token",
			unit_size: 1,
			price_per_unit: rule.pricePerUnit,
			currency: "USD",
			match: [],
			priority: 100,
		})),
	} as any;
}

describe("isFreePriceCard", () => {
	it("accepts a non-empty card whose rules are explicitly free and zero", () => {
		expect(
			isFreePriceCard(card([
				{ pricingPlan: "free", pricePerUnit: "0" },
				{ pricingPlan: "FREE", pricePerUnit: "0.000000" },
			])),
		).toBe(true);
	});

	it("rejects missing and empty pricing cards", () => {
		expect(isFreePriceCard(null)).toBe(false);
		expect(isFreePriceCard(card([]))).toBe(false);
	});

	it("rejects a free-labelled card containing a positive price", () => {
		expect(
			isFreePriceCard(card([
				{ pricingPlan: "free", pricePerUnit: "0" },
				{ pricingPlan: "free", pricePerUnit: "0.000001" },
			])),
		).toBe(false);
	});

	it("rejects negative prices instead of treating them as free", () => {
		expect(
			isFreePriceCard(card([
				{ pricingPlan: "free", pricePerUnit: "-0.000001" },
			])),
		).toBe(false);
	});

	it("rejects zero-priced rules that are not explicitly on the free plan", () => {
		expect(
			isFreePriceCard(card([
				{ pricingPlan: "standard", pricePerUnit: "0" },
			])),
		).toBe(false);
	});
});
