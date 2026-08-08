import {
	isTerminalRuntimeStatsRetry,
	resolveRuntimeStatsPercentileAfterError,
} from "./ModelPricingClient";

describe("runtime pricing percentile retries", () => {
	it("keeps the attempted percentile selected through transient failures", () => {
		expect(isTerminalRuntimeStatsRetry(1)).toBe(false);
		expect(isTerminalRuntimeStatsRetry(2)).toBe(false);
		expect(resolveRuntimeStatsPercentileAfterError(90, 50, 1)).toBe(90);
		expect(resolveRuntimeStatsPercentileAfterError(90, 50, 2)).toBe(90);
	});

	it("restores the last successful percentile after retries are exhausted", () => {
		expect(isTerminalRuntimeStatsRetry(3)).toBe(true);
		expect(resolveRuntimeStatsPercentileAfterError(90, 50, 3)).toBe(50);
	});
});
