import { describe, expect, it } from "vitest";
import { parseProviderRateLimitConfig } from "./provider-rate-limits";

describe("provider rate-limit configuration", () => {
	it("normalizes an enabled database row", () => {
		expect(parseProviderRateLimitConfig({
			provider_id: "openai",
			requests_per_minute: 500,
			requests_per_day: null,
			tokens_per_minute: "100000",
			tokens_per_day: null,
			headroom_bps: 500,
			enabled: true,
		})).toEqual({
			providerId: "openai",
			requestsPerMinute: 500,
			requestsPerDay: null,
			tokensPerMinute: 100000,
			tokensPerDay: null,
			headroomBps: 500,
		});
	});

	it("ignores disabled rows and rows without a limit", () => {
		expect(parseProviderRateLimitConfig({ provider_id: "openai", enabled: false })).toBeNull();
		expect(parseProviderRateLimitConfig({ provider_id: "openai", enabled: true })).toBeNull();
	});
});
