import { identityAddonPricing, isWorkspaceAddonActive } from "./identityAddon";

describe("identity addon", () => {
	const originalEnv = process.env;

	afterEach(() => {
		process.env = originalEnv;
		jest.restoreAllMocks();
	});

	it("treats active and trialing subscriptions as entitled", () => {
		expect(isWorkspaceAddonActive({ status: "active" })).toBe(true);
		expect(isWorkspaceAddonActive({ status: "trialing" })).toBe(true);
	});

	it("honours a past-due grace period but rejects expired or terminal states", () => {
		jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-20T12:00:00Z"));
		expect(
			isWorkspaceAddonActive({
				status: "past_due",
				grace_until: "2026-08-21T12:00:00Z",
			}),
		).toBe(true);
		expect(
			isWorkspaceAddonActive({
				status: "past_due",
				grace_until: "2026-08-19T12:00:00Z",
			}),
		).toBe(false);
		expect(isWorkspaceAddonActive({ status: "canceled" })).toBe(false);
		expect(isWorkspaceAddonActive(null)).toBe(false);
	});

	it("uses configurable pricing with the public defaults", () => {
		process.env = {
			...originalEnv,
			IDENTITY_ADDON_MONTHLY_PRICE_USD: "149",
			IDENTITY_ADDON_INCLUDED_SSO_USERS: "750",
			IDENTITY_ADDON_OVERAGE_USD: "0.15",
		};
		expect(identityAddonPricing()).toEqual({
			currency: "usd",
			monthlyUsd: 149,
			includedSsoUsers: 750,
			overageUsd: 0.15,
		});
	});
});
