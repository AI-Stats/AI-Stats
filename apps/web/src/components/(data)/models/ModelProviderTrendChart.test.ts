import {
	getSeriesEmphasis,
	isUsableMetricValue,
} from "./ModelProviderTrendChart";

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
});
