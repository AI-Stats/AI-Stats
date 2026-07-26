import { describe, expect, it } from "vitest";
import {
	applyDataContributionDiscount,
	currentDataContributionDiscountNanos,
} from "./data-contribution-discount";

describe("applyDataContributionDiscount", () => {
	it("applies a visible one percent discount and snapshots it on pricing lines", () => {
		const result = applyDataContributionDiscount({
			pricedUsage: { pricing: { total_nanos: 1_000_000_000, lines: [{ line_nanos: 1_000_000_000 }] } },
			totalNanos: 1_000_000_000,
			enabled: true,
			isByok: false,
			discountBps: 100,
		});

		expect(result.totalNanos).toBe(990_000_000);
		expect(result.discountNanos).toBe(10_000_000);
		expect(result.pricedUsage.pricing).toMatchObject({
			subtotal_nanos: 1_000_000_000,
			data_contribution_discount_bps: 100,
			data_contribution_discount_nanos: 10_000_000,
			total_nanos: 990_000_000,
		});
		expect(result.pricedUsage.pricing.lines).toEqual([expect.objectContaining({
			base_line_nanos: 1_000_000_000,
			data_contribution_discount_nanos: 10_000_000,
			line_nanos: 990_000_000,
		})]);
	});

	it("does not discount BYOK service fees", () => {
		const result = applyDataContributionDiscount({
			pricedUsage: { pricing: { total_nanos: 1_000 } },
			totalNanos: 1_000,
			enabled: true,
			isByok: true,
			discountBps: 100,
		});
		expect(result.totalNanos).toBe(1_000);
		expect(result.discountNanos).toBe(0);
	});

	it("allocates rounding across lines so their sum equals the charged total", () => {
		const result = applyDataContributionDiscount({
			pricedUsage: { pricing: { lines: [{ line_nanos: 501 }, { line_nanos: 500 }] } },
			totalNanos: 1001,
			enabled: true,
			isByok: false,
			discountBps: 100,
		});
		expect(result.discountNanos).toBe(10);
		expect(result.pricedUsage.pricing.lines.reduce((sum: number, line: any) => sum + line.line_nanos, 0)).toBe(result.totalNanos);
	});

	it("does not reuse a cached generation discount on a free cache hit", () => {
		expect(currentDataContributionDiscountNanos({
			data_contribution_discount_nanos: 10_000_000,
		}, 0)).toBe(0);
		expect(currentDataContributionDiscountNanos({
			data_contribution_discount_nanos: 10_000_000,
		}, 990_000_000)).toBe(10_000_000);
	});
});
