import { matchesProviderCoverage, toggleProviderCoverage } from "./providerFilters";
import type { APIProviderCard } from "@/lib/fetchers/api-providers/providerDataTypes";

function makeProvider(overrides: Partial<APIProviderCard> = {}): APIProviderCard {
	return {
		api_provider_id: "test-provider",
		api_provider_name: "Test Provider",
		country_code: "US",
		is_gateway_provider: false,
		prompt_training_policy: null,
		data_policy_tier: null,
		zero_data_retention: null,
		data_retention_days: null,
		privacy_policy_url: null,
		terms_of_service_url: null,
		total_models: 1,
		active_models: 0,
		free_models: 0,
		total_daily_tokens: 0,
		total_monthly_tokens: 0,
		daily_share_pct: 0,
		modality_support: {
			text: { input: 0, output: 0 },
			image: { input: 0, output: 0 },
			video: { input: 0, output: 0 },
			audio: { input: 0, output: 0 },
			moderation: { input: 0, output: 0 },
			embedding: { input: 0, output: 0 },
		},
		...overrides,
	};
}

describe("matchesProviderCoverage", () => {
	it("matches inactive providers without routable models", () => {
		expect(matchesProviderCoverage(makeProvider(), "inactive")).toBe(true);
		expect(matchesProviderCoverage(makeProvider({ is_gateway_provider: true }), "inactive")).toBe(false);
		expect(matchesProviderCoverage(makeProvider({ active_models: 1 }), "inactive")).toBe(false);
	});

	it("preserves the existing active and free coverage filters", () => {
		expect(matchesProviderCoverage(makeProvider({ is_gateway_provider: true }), "active")).toBe(true);
		expect(matchesProviderCoverage(makeProvider({ free_models: 1 }), "free")).toBe(true);
		expect(matchesProviderCoverage(makeProvider(), "active")).toBe(false);
		expect(matchesProviderCoverage(makeProvider(), "free")).toBe(false);
	});
});

describe("toggleProviderCoverage", () => {
	it("replaces the default active filter when inactive is selected", () => {
		expect(toggleProviderCoverage(["active"], "inactive")).toEqual(["inactive"]);
		expect(toggleProviderCoverage(["inactive"], "active")).toEqual(["active"]);
	});

	it("preserves other coverage filters", () => {
		expect(toggleProviderCoverage(["active", "free"], "inactive")).toEqual(["free", "inactive"]);
		expect(toggleProviderCoverage(["inactive", "free"], "free")).toEqual(["inactive"]);
	});
});
