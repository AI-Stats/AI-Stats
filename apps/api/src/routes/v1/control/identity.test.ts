import { describe, expect, it } from "vitest";
import { normalizeSso } from "./identity";

describe("identity management", () => {
	it("normalizes and deduplicates workspace SSO domains", () => {
		expect(normalizeSso({
			enabled: true,
			mode: "saml",
			provider_identifier: "5f6ec0f5-d5ce-4f71-99df-5f720ea59750",
			domains: [" Example.com ", "example.com"],
		})).toEqual({ value: {
			sso_enabled: true,
			sso_enforced: false,
			sso_mode: "saml",
			sso_provider_identifier: "5f6ec0f5-d5ce-4f71-99df-5f720ea59750",
			sso_domains: ["example.com"],
		} });
	});

	it("rejects SSO enforcement until the platform supports it", () => {
		expect(normalizeSso({ enabled: true, enforced: true })).toEqual({ error: "sso_enforcement_not_available" });
	});
});
