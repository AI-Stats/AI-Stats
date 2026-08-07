import {
	calculateCachedInputAverage,
	getHoverDateTextAnchor,
	getSeriesEmphasis,
	isUsableMetricValue,
} from "./ModelProviderTrendChart";

describe("calculateCachedInputAverage", () => {
	it("weights provider days by effective input token volume", () => {
		const points = [
			{ cachedInputTokens: 10, effectiveInputTokens: 100, cachedInputPct: 10 },
			{ cachedInputTokens: 9_000, effectiveInputTokens: 10_000, cachedInputPct: 90 },
		] as Parameters<typeof calculateCachedInputAverage>[0];

		expect(calculateCachedInputAverage(points)).toBeCloseTo(89.2079, 4);
	});
});

describe("getSeriesEmphasis", () => {
	it("emphasizes the hovered series and dims every other series", () => {
		expect(getSeriesEmphasis("p90", "p90")).toEqual({
			isActive: true,
			isDimmed: false,
		});
		expect(getSeriesEmphasis("p90", "p50")).toEqual({
			isActive: false,
			isDimmed: true,
		});
	});

	it("keeps all series at their normal emphasis without a hover target", () => {
		expect(getSeriesEmphasis(null, "provider-openai")).toEqual({
			isActive: false,
			isDimmed: false,
		});
	});
});

describe("getHoverDateTextAnchor", () => {
	it("centres a lone point and interior dates", () => {
		expect(getHoverDateTextAnchor(0, 1)).toBe("middle");
		expect(getHoverDateTextAnchor(1, 3)).toBe("middle");
	});

	it("keeps edge dates inside a multi-point chart", () => {
		expect(getHoverDateTextAnchor(0, 3)).toBe("start");
		expect(getHoverDateTextAnchor(2, 3)).toBe("end");
	});
});

describe("isUsableMetricValue", () => {
	it("hides impossible zero-valued timing and speed samples", () => {
		expect(isUsableMetricValue("outputSpeed", 0)).toBe(false);
		expect(isUsableMetricValue("latency", 0)).toBe(false);
		expect(isUsableMetricValue("tpot", 0)).toBe(false);
		expect(isUsableMetricValue("throughput", 46.2)).toBe(true);
	});

	it("allows zero gateway overhead because it is a valid measurement", () => {
		expect(isUsableMetricValue("overhead", 0)).toBe(true);
	});

	it("allows zero cached input because no cache use is meaningful", () => {
		expect(isUsableMetricValue("cachedInput", 0)).toBe(true);
	});
});
