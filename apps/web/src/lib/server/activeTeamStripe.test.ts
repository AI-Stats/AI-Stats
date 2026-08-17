export {};

const requireServerIdentity = jest.fn();
const findWorkspaceStripeCustomer = jest.fn();
const upsertWorkspaceStripeCustomer = jest.fn();
const getWorkspaceIdFromCookie = jest.fn();
const requireWorkspaceMembership = jest.fn();
const getStripe = jest.fn();

jest.mock("@/lib/auth/serverIdentity", () => ({ requireServerIdentity }));
jest.mock("@/lib/database/repositories/billing", () => ({
	findWorkspaceStripeCustomer,
	upsertWorkspaceStripeCustomer,
}));
jest.mock("@/utils/workspaceCookie", () => ({ getWorkspaceIdFromCookie }));
jest.mock("@/utils/serverActionAuth", () => ({ requireWorkspaceMembership }));
jest.mock("@/lib/stripe", () => ({ getStripe }));

describe("active team Stripe customer", () => {
	beforeEach(() => {
		jest.resetModules();
		requireServerIdentity.mockReset();
		findWorkspaceStripeCustomer.mockReset();
		upsertWorkspaceStripeCustomer.mockReset();
		getWorkspaceIdFromCookie.mockReset();
		requireWorkspaceMembership.mockReset();
		getStripe.mockReset();
	});

	it("repairs a stored customer missing from the current Stripe account", async () => {
		requireServerIdentity.mockResolvedValue({
			user: { id: "user_1", email: "owner@example.com", user_metadata: { full_name: "Owner User" } },
		});
		getWorkspaceIdFromCookie.mockResolvedValue("ws_1");
		requireWorkspaceMembership.mockResolvedValue(undefined);
		findWorkspaceStripeCustomer.mockResolvedValue({ workspaceId: "ws_1", stripeCustomerId: "cus_stale" });
		getStripe.mockReturnValue({
			customers: {
				retrieve: jest.fn(async () => {
					const error: any = new Error("No such customer: 'cus_stale'");
					error.code = "resource_missing";
					error.param = "id";
					throw error;
				}),
				search: jest.fn(async () => ({ data: [{ id: "cus_repaired" }] })),
				list: jest.fn(async () => ({ data: [] })),
				create: jest.fn(async () => ({ id: "cus_created" })),
			},
		});

		const { requireActiveTeamStripeCustomer } = await import("./activeTeamStripe");
		await expect(requireActiveTeamStripeCustomer()).resolves.toMatchObject({
			workspaceId: "ws_1",
			customerId: "cus_repaired",
			userId: "user_1",
		});
		expect(requireWorkspaceMembership).toHaveBeenCalledWith("user_1", "ws_1", ["owner", "admin"]);
		expect(upsertWorkspaceStripeCustomer).toHaveBeenCalledWith("ws_1", "cus_repaired");
	});

	it("rejects members without a billing administrator role", async () => {
		requireServerIdentity.mockResolvedValue({ user: { id: "member_1", email: "member@example.com" } });
		getWorkspaceIdFromCookie.mockResolvedValue("ws_1");
		requireWorkspaceMembership.mockRejectedValue(new Error("Unauthorized"));

		const { requireActiveTeamStripeCustomer } = await import("./activeTeamStripe");
		await expect(requireActiveTeamStripeCustomer()).rejects.toThrow("unauthorized");
		expect(findWorkspaceStripeCustomer).not.toHaveBeenCalled();
	});

	it("allows members to read an existing Stripe summary without repairing it", async () => {
		requireServerIdentity.mockResolvedValue({ user: { id: "member_1", email: "member@example.com" } });
		getWorkspaceIdFromCookie.mockResolvedValue("ws_1");
		requireWorkspaceMembership.mockResolvedValue(undefined);
		findWorkspaceStripeCustomer.mockResolvedValue({ workspaceId: "ws_1", stripeCustomerId: "cus_existing" });
		getStripe.mockReturnValue({
			customers: {
				retrieve: jest.fn(async () => ({
					id: "cus_existing",
					email: "billing@example.com",
					metadata: { workspace_id: "ws_1" },
					invoice_settings: { default_payment_method: null },
				})),
			},
			paymentMethods: { list: jest.fn(async () => ({ data: [] })) },
		});

		const { getActiveTeamStripeSummary } = await import("./activeTeamStripe");
		await expect(getActiveTeamStripeSummary()).resolves.toMatchObject({
			customer: { id: "cus_existing", email: "billing@example.com" },
			paymentMethods: [],
		});
		expect(requireWorkspaceMembership).toHaveBeenCalledWith("member_1", "ws_1", ["owner", "admin", "member"]);
		expect(upsertWorkspaceStripeCustomer).not.toHaveBeenCalled();
	});

	it("returns an empty summary when a member has no Stripe binding", async () => {
		requireServerIdentity.mockResolvedValue({ user: { id: "member_1", email: "member@example.com" } });
		getWorkspaceIdFromCookie.mockResolvedValue("ws_1");
		requireWorkspaceMembership.mockResolvedValue(undefined);
		findWorkspaceStripeCustomer.mockResolvedValue(null);
		getStripe.mockReturnValue({ customers: {} });

		const { getActiveTeamStripeSummary } = await import("./activeTeamStripe");
		await expect(getActiveTeamStripeSummary()).resolves.toEqual({
			customer: { id: "", email: null },
			defaultPaymentMethodId: null,
			paymentMethods: [],
		});
		expect(upsertWorkspaceStripeCustomer).not.toHaveBeenCalled();
	});
});
