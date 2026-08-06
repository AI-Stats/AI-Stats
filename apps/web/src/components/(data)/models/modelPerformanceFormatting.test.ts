import { formatProviderDuration } from "@/components/(data)/models/modelPerformanceFormatting";

describe("formatProviderDuration", () => {
	it("shows provider duration in seconds", () => {
		expect(formatProviderDuration(5_312)).toBe("5.31 s");
		expect(formatProviderDuration(13_785)).toBe("13.8 s");
		expect(formatProviderDuration(999_600)).toBe("1,000 s");
	});

	it("switches to minutes above one thousand seconds", () => {
		expect(formatProviderDuration(1_000_000)).toBe("1,000 s");
		expect(formatProviderDuration(1_000_001)).toBe("16.7 min");
		expect(formatProviderDuration(7_200_000)).toBe("120 min");
	});

	it("handles missing values", () => {
		expect(formatProviderDuration(null)).toBe("-");
	});
});
