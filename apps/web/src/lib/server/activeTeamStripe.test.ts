export {};

const createClient = jest.fn();
const createAdminClient = jest.fn();
const getWorkspaceIdFromCookie = jest.fn();
const requireWorkspaceMembership = jest.fn();
const getStripe = jest.fn();

jest.mock("@/utils/supabase/server", () => ({
	createClient,
}));

jest.mock("@/utils/supabase/admin", () => ({
	createAdminClient,
}));

jest.mock("@/utils/workspaceCookie", () => ({
	getWorkspaceIdFromCookie,
}));

jest.mock("@/utils/serverActionAuth", () => ({
	requireWorkspaceMembership,
}));

jest.mock("@/lib/stripe", () => ({
	getStripe,
}));

describe("requireActiveTeamStripeCustomer", () => {
	beforeEach(() => {
		jest.resetModules();
		createClient.mockReset();
		createAdminClient.mockReset();
		getWorkspaceIdFromCookie.mockReset();
		requireWorkspaceMembership.mockReset();
		getStripe.mockReset();
	});

	it("repairs a stored customer id that is missing in the current Stripe account", async () => {
		const user = {
			id: "user_1",
			email: "owner@example.com",
			user_metadata: { full_name: "Owner User" },
		};

		const walletQuery: any = {
			select: jest.fn(() => walletQuery),
			eq: jest.fn(() => walletQuery),
			maybeSingle: jest.fn(async () => ({
				data: { workspace_id: "ws_1", stripe_customer_id: "cus_stale" },
				error: null,
			})),
		};

		createClient.mockResolvedValue({
			auth: {
				getUser: jest.fn(async () => ({
					data: { user },
					error: null,
				})),
			},
			from: jest.fn(() => walletQuery),
		} as any);

		const adminUpsert = jest.fn(async () => ({ error: null }));
		createAdminClient.mockReturnValue({
			from: jest.fn(() => ({
				upsert: adminUpsert,
			})),
		} as any);

		getWorkspaceIdFromCookie.mockResolvedValue("ws_1");
		requireWorkspaceMembership.mockResolvedValue(undefined);

		getStripe.mockReturnValue({
			customers: {
				retrieve: jest.fn(async () => {
					const error: any = new Error("No such customer: 'cus_stale'");
					error.code = "resource_missing";
					error.param = "id";
					throw error;
				}),
				search: jest.fn(async () => ({
					data: [{ id: "cus_test_mode" }],
				})),
				list: jest.fn(async () => ({ data: [] })),
				create: jest.fn(async () => ({ id: "cus_created" })),
			},
		});

		const { requireActiveTeamStripeCustomer } = await import("./activeTeamStripe");
		const result = await requireActiveTeamStripeCustomer();

		expect(result).toMatchObject({
			workspaceId: "ws_1",
			customerId: "cus_test_mode",
			userId: "user_1",
			userEmail: "owner@example.com",
		});
		expect(requireWorkspaceMembership).toHaveBeenCalledWith(
			expect.anything(),
			"user_1",
			"ws_1",
			["owner", "admin"],
		);
		expect(adminUpsert).toHaveBeenCalledWith(
			{ workspace_id: "ws_1", stripe_customer_id: "cus_test_mode" },
			{ onConflict: "workspace_id", ignoreDuplicates: false },
		);
	});

	it("rejects a workspace member who lacks a billing administrator role", async () => {
		createClient.mockResolvedValue({
			auth: {
				getUser: jest.fn(async () => ({
					data: { user: { id: "member_1", email: "member@example.com" } },
					error: null,
				})),
			},
		} as any);
		getWorkspaceIdFromCookie.mockResolvedValue("ws_1");
		requireWorkspaceMembership.mockRejectedValue(new Error("Unauthorized"));

		const { requireActiveTeamStripeCustomer } = await import("./activeTeamStripe");
		await expect(requireActiveTeamStripeCustomer()).rejects.toThrow("unauthorized");
		expect(requireWorkspaceMembership).toHaveBeenCalledWith(
			expect.anything(),
			"member_1",
			"ws_1",
			["owner", "admin"],
		);
	});

	it("never adopts a Stripe customer by email when workspace metadata has no match", async () => {
		const user = { id: "user_1", email: "shared@example.com", user_metadata: {} };
		const walletQuery: any = {
			select: jest.fn(() => walletQuery),
			eq: jest.fn(() => walletQuery),
			maybeSingle: jest.fn(async () => ({ data: null, error: null })),
		};
		createClient.mockResolvedValue({
			auth: { getUser: jest.fn(async () => ({ data: { user }, error: null })) },
			from: jest.fn(() => walletQuery),
		} as any);
		createAdminClient.mockReturnValue({
			from: jest.fn(() => ({ upsert: jest.fn(async () => ({ error: null })) })),
		} as any);
		getWorkspaceIdFromCookie.mockResolvedValue("ws_1");
		requireWorkspaceMembership.mockResolvedValue(undefined);
		const list = jest.fn(async () => ({ data: [{ id: "cus_other_workspace" }] }));
		const create = jest.fn(async () => ({ id: "cus_new_workspace" }));
		getStripe.mockReturnValue({
			customers: {
				search: jest.fn(async () => ({ data: [] })),
				list,
				create,
			},
		});

		const { requireActiveTeamStripeCustomer } = await import("./activeTeamStripe");
		await expect(requireActiveTeamStripeCustomer({ createIfMissing: true })).resolves.toMatchObject({
			customerId: "cus_new_workspace",
		});
		expect(list).not.toHaveBeenCalled();
		expect(create).toHaveBeenCalledWith(expect.objectContaining({
			metadata: { workspace_id: "ws_1", user_id: "user_1" },
		}));
	});

	it("allows members to read an existing Stripe summary without repairing bindings", async () => {
		const walletQuery: any = {
			select: jest.fn(() => walletQuery),
			eq: jest.fn(() => walletQuery),
			maybeSingle: jest.fn(async () => ({
				data: { workspace_id: "ws_1", stripe_customer_id: "cus_existing" },
				error: null,
			})),
		};
		createClient.mockResolvedValue({
			auth: {
				getUser: jest.fn(async () => ({
					data: { user: { id: "member_1", email: "member@example.com" } },
					error: null,
				})),
			},
			from: jest.fn(() => walletQuery),
		} as any);
		getWorkspaceIdFromCookie.mockResolvedValue("ws_1");
		requireWorkspaceMembership.mockResolvedValue(undefined);
		const retrieve = jest.fn(async () => ({
			id: "cus_existing",
			email: "billing@example.com",
			metadata: { workspace_id: "ws_1" },
			invoice_settings: { default_payment_method: null },
		}));
		getStripe.mockReturnValue({
			customers: { retrieve },
			paymentMethods: { list: jest.fn(async () => ({ data: [] })) },
		});

		const { getActiveTeamStripeSummary } = await import("./activeTeamStripe");
		await expect(getActiveTeamStripeSummary()).resolves.toMatchObject({
			customer: { id: "cus_existing", email: "billing@example.com" },
			paymentMethods: [],
		});
		expect(requireWorkspaceMembership).toHaveBeenCalledWith(
			expect.anything(),
			"member_1",
			"ws_1",
			["owner", "admin", "member"],
		);
		expect(createAdminClient).not.toHaveBeenCalled();
	});

	it("returns a recoverable empty summary for members with an invalid Stripe binding", async () => {
		const walletQuery: any = {
			select: jest.fn(() => walletQuery),
			eq: jest.fn(() => walletQuery),
			maybeSingle: jest.fn(async () => ({
				data: { workspace_id: "ws_1", stripe_customer_id: "cus_stale" },
				error: null,
			})),
		};
		createClient.mockResolvedValue({
			auth: {
				getUser: jest.fn(async () => ({
					data: { user: { id: "member_1", email: "member@example.com" } },
					error: null,
				})),
			},
			from: jest.fn(() => walletQuery),
		} as any);
		getWorkspaceIdFromCookie.mockResolvedValue("ws_1");
		requireWorkspaceMembership.mockResolvedValue(undefined);
		getStripe.mockReturnValue({
			customers: {
				retrieve: jest.fn(async () => {
					const error: any = new Error("No such customer: 'cus_stale'");
					error.code = "resource_missing";
					error.param = "id";
					throw error;
				}),
			},
		});

		const { getActiveTeamStripeSummary } = await import("./activeTeamStripe");
		await expect(getActiveTeamStripeSummary()).resolves.toEqual({
			customer: { id: "", email: null },
			defaultPaymentMethodId: null,
			paymentMethods: [],
		});
		expect(createAdminClient).not.toHaveBeenCalled();
	});
});
