import {
	getProviderServiceTierDisplayName,
	isTerminalRuntimeStatsRetry,
	resolveRuntimeStatsPercentileAfterError,
} from "./ModelPricingClient";
import type { ProviderPricing } from "@/lib/fetchers/models/getModelPricing";

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

describe("provider service tier display names", () => {
	it("keeps regional offer labels on every generated service tier row", () => {
		const provider = {
			provider: {
				api_provider_id: "openai-eu",
				api_provider_name: "OpenAI",
				offer_label: "EU",
				offer_scope: "regional",
			},
			provider_models: [],
			pricing_rules: [],
		} as ProviderPricing;

		expect(getProviderServiceTierDisplayName(provider)).toBe("OpenAI (EU)");
	});
});
