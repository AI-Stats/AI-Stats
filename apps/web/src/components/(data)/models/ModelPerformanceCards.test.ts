import type { ModelProviderDailyPoint } from "@/lib/fetchers/models/getModelPerformance";
import { selectMetricData } from "./ModelPerformanceCards";

function point(
	provider: string,
	avgEndToEndMs: number | null,
): ModelProviderDailyPoint {
	return {
		provider,
		providerName: provider,
		providerColor: null,
		day: "2026-08-08",
		avgThroughput: null,
		avgOutputSpeed: null,
		avgLatencyMs: null,
		avgEndToEndMs,
		avgGenerationMs: null,
		avgPhaseoOverheadMs: null,
		avgTpotMs: null,
		avgItlMs: null,
		cachedInputPct: null,
		cachedInputTokens: null,
		effectiveInputTokens: null,
		cacheTelemetryRequests: 0,
		requests: 1,
	};
}

describe("selectMetricData", () => {
	it("falls back to detailed percentile data when the compact bands are empty", () => {
		const detailData = [point("percentile-95", 42)];
		const cardData = [point("percentile-50", null)];

		expect(
			selectMetricData(
				"endToEnd",
				false,
				detailData,
				cardData,
				true,
			),
		).toBe(detailData);
	});

	it("keeps the compact percentile bands when they contain the metric", () => {
		const detailData = [point("percentile-95", 42)];
		const cardData = [point("percentile-50", 30)];

		expect(
			selectMetricData(
				"endToEnd",
				false,
				detailData,
				cardData,
				true,
			),
		).toBe(cardData);
	});
});
