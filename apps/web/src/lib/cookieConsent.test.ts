import { readAnalyticsConsentFromCookieHeader } from "./cookieConsent";

describe("readAnalyticsConsentFromCookieHeader", () => {
	it("reads accepted consent from a request cookie header", () => {
		expect(readAnalyticsConsentFromCookieHeader("other=1; phaseo_analytics_consent=accepted")).toBe("accepted");
	});

	it("fails closed for missing or invalid consent", () => {
		expect(readAnalyticsConsentFromCookieHeader(null)).toBeNull();
		expect(readAnalyticsConsentFromCookieHeader("phaseo_analytics_consent=pending")).toBeNull();
	});
});
