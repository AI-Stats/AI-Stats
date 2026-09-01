import { describe, expect, it } from "vitest";
import type { PriceCard } from "../pricing/types";
import { classifyZeroCostBillingAnomaly } from "./billing-integrity";

function card(plan = "standard", price = "1"): PriceCard {
	return {
		provider: "provider",
		model: "publisher/model",
		endpoint: "text.generate",
		effective_from: null,
		effective_to: null,
		currency: "USD",
		version: "1",
		rules: [{ pricing_plan: plan, meter: "input_text_tokens", unit: "token", unit_size: 1_000_000, price_per_unit: price, currency: "USD", match: [], priority: 1 }],
	};
}

describe("classifyZeroCostBillingAnomaly", () => {
	it("flags observed usage on a paid card when no pricing line was produced", () => {
		expect(classifyZeroCostBillingAnomaly({
			card: card(), pricedUsage: { input_text_tokens: 12, pricing: { lines: [] } }, costNanos: 0, isByok: false,
		})).toBe("billable_usage_zero_cost");
	});

	it("flags a zero total when pricing produced a positive-quantity line", () => {
		expect(classifyZeroCostBillingAnomaly({
			card: card(), pricedUsage: { pricing: { lines: [{ quantity: 12, line_nanos: 0 }] } }, costNanos: 0, isByok: false,
		})).toBe("priced_lines_zero_total");
	});

	it("allows explicitly free cards", () => {
		expect(classifyZeroCostBillingAnomaly({
			card: card("free", "0"), pricedUsage: { input_text_tokens: 12 }, costNanos: 0, isByok: false,
		})).toBeNull();
	});

	it("allows BYOK requests inside the free request allowance", () => {
		expect(classifyZeroCostBillingAnomaly({
			card: card(), pricedUsage: { input_text_tokens: 12, pricing: { byok_fee_applied: false } }, costNanos: 0, isByok: true,
		})).toBeNull();
	});

	it("allows an explicit full data-contribution discount", () => {
		expect(classifyZeroCostBillingAnomaly({
			card: card(), pricedUsage: { pricing: { subtotal_nanos: 100, data_contribution_discount_nanos: 100, lines: [{ quantity: 12 }] } }, costNanos: 0, isByok: false,
		})).toBeNull();
	});

	it("ignores successful requests without observed billable usage", () => {
		expect(classifyZeroCostBillingAnomaly({ card: card(), pricedUsage: {}, costNanos: 0, isByok: false })).toBeNull();
	});
});
