import { describe, expect, it } from "vitest";
import { parseProviderRateLimitConfig, resolveProviderRateLimitDenial } from "./provider-rate-limits";

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

	it("uses the latest reset when minute and daily limits are both exhausted", () => {
		const nowMs = Date.UTC(2026, 8, 3, 12, 30, 0);
		const minuteWindow = Math.floor(nowMs / 60_000);
		const dayWindow = Math.floor(nowMs / 86_400_000);
		expect(resolveProviderRateLimitDenial({
			providerId: "openai",
			requestsPerMinute: 10,
			requestsPerDay: 100,
			tokensPerMinute: null,
			tokensPerDay: null,
			headroomBps: 500,
		}, {
			minuteWindow,
			dayWindow,
			minuteRequests: 10,
			dayRequests: 100,
			minuteTokens: 0,
			dayTokens: 0,
		}, nowMs)).toEqual({
			allowed: false,
			reason: "requests_per_day",
			retryAfterSeconds: 41_400,
		});
	});
});
