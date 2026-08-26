import { describe, expect, it } from "vitest";
import {
	applyDownstreamRateLimitHeaders,
	extractDownstreamRateLimitHeaders,
} from "./upstream-rate-limit-headers";

describe("upstream rate-limit response headers", () => {
	it("exposes validated retry guidance but hides managed-key quota details", () => {
		const result = extractDownstreamRateLimitHeaders(new Headers({
			"retry-after": "12",
			"x-ratelimit-limit-requests": "100",
			"x-ratelimit-remaining-requests": "0",
			"set-cookie": "provider_session=secret",
			"x-provider-account-id": "private-account",
		}), { includeQuotaDetails: false });

		expect(result).toEqual({ "Retry-After": "12" });
	});

	it("prefixes allowlisted quota details for BYOK without copying other headers", () => {
		const result = extractDownstreamRateLimitHeaders(new Headers({
			"ratelimit-limit": "1000",
			"x-ratelimit-remaining-tokens": "24500",
			"x-ratelimit-reset-tokens": "2m30s",
			"authorization": "Bearer provider-secret",
			"set-cookie": "provider_session=secret",
		}), { includeQuotaDetails: true });

		expect(result).toEqual({
			"X-Phaseo-Upstream-RateLimit-Limit": "1000",
			"X-Phaseo-Upstream-RateLimit-Remaining-Tokens": "24500",
			"X-Phaseo-Upstream-RateLimit-Reset-Tokens": "2m30s",
		});
	});

	it("rejects malformed values and can synthesize bounded retry guidance", () => {
		const result = extractDownstreamRateLimitHeaders(new Headers({
			"retry-after": "not-a-delay",
			"x-ratelimit-limit": "private account unlimited",
		}), { includeQuotaDetails: true, fallbackRetryAfterMs: 10_001 });

		expect(result).toEqual({ "Retry-After": "11" });
	});

	it("applies only known downstream names", () => {
		const headers = new Headers();
		applyDownstreamRateLimitHeaders(headers, {
			"Retry-After": "10",
			"X-Phaseo-Upstream-RateLimit-Remaining": "0",
			"Set-Cookie": "secret=true",
		});

		expect(headers.get("Retry-After")).toBe("10");
		expect(headers.get("X-Phaseo-Upstream-RateLimit-Remaining")).toBe("0");
		expect(headers.get("Set-Cookie")).toBeNull();
	});
});
