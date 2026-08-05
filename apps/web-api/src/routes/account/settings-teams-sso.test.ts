import { describe, expect, it } from "vitest";
import { normalizeWorkspaceSsoUpdate } from "./settings-teams";

describe("workspace SSO settings normalization", () => {
	it("normalizes a disabled SAML connection without enforcing it", () => {
		expect(
			normalizeWorkspaceSsoUpdate({
				ssoEnabled: false,
				ssoEnforced: false,
				ssoMode: "saml",
				ssoProviderIdentifier: "5f6ec0f5-d5ce-4f71-99df-5f720ea59750",
				ssoDomains: [" Example.com ", "example.com"],
			}),
		).toEqual({
			value: {
				sso_enabled: false,
				sso_enforced: false,
				sso_mode: "saml",
				sso_provider_identifier: "5f6ec0f5-d5ce-4f71-99df-5f720ea59750",
				sso_domains: ["example.com"],
			},
		});
	});

	it("requires a provider and domain before enabling SAML", () => {
		expect(
			normalizeWorkspaceSsoUpdate({
				ssoEnabled: true,
				ssoMode: "saml",
				ssoDomains: [],
			}),
		).toEqual({ error: "sso_provider_required" });
	});

	it("rejects malformed SAML provider identifiers", () => {
		expect(
			normalizeWorkspaceSsoUpdate({
				ssoEnabled: false,
				ssoMode: "saml",
				ssoProviderIdentifier: "provider-1",
				ssoDomains: ["example.com"],
			}),
		).toEqual({ error: "invalid_saml_provider_id" });
	});

	it("keeps enforcement unavailable during the scaffold rollout", () => {
		expect(
			normalizeWorkspaceSsoUpdate({
				ssoEnabled: true,
				ssoEnforced: true,
				ssoMode: "saml",
				ssoProviderIdentifier: "5f6ec0f5-d5ce-4f71-99df-5f720ea59750",
				ssoDomains: ["example.com"],
			}),
		).toEqual({ error: "sso_enforcement_not_available" });
	});
});
