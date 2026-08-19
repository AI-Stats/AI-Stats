import { isSocialProviderId, SOCIAL_PROVIDER_IDS } from "./oauthProviders";

describe("OAuth providers", () => {
	it("supports every social provider rendered by the auth forms", () => {
		expect(SOCIAL_PROVIDER_IDS).toEqual(["google", "github", "gitlab"]);
		for (const provider of SOCIAL_PROVIDER_IDS) {
			expect(isSocialProviderId(provider)).toBe(true);
		}
	});

	it("rejects missing and unsupported submitters", () => {
		expect(isSocialProviderId(undefined)).toBe(false);
		expect(isSocialProviderId("email")).toBe(false);
	});
});
