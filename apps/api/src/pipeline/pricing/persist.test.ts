import { beforeEach, describe, expect, it, vi } from "vitest";

const chargeRequestMock = vi.fn();
const getLowBalanceStateMock = vi.fn();
const invalidateGatewayCreditCacheMock = vi.fn();
const releaseRuntimeMock = vi.fn();
const enqueueAutoTopUpFailedEmailMock = vi.fn();

vi.mock("stripe", () => ({
	default: class StripeMock {
		customers = { retrieve: vi.fn() };
		paymentMethods = { list: vi.fn() };
		paymentIntents = { create: vi.fn() };
	},
}));

vi.mock("../../runtime/env", () => ({
	ensureRuntimeForBackground: vi.fn(() => releaseRuntimeMock),
}));

vi.mock("../../repositories/pricing-persistence", () => ({
	chargeRequest: (...args: unknown[]) => chargeRequestMock(...args),
	getLowBalanceState: (...args: unknown[]) => getLowBalanceStateMock(...args),
}));

vi.mock("../../core/gateway-credit-cache", () => ({
	invalidateGatewayCreditCache: (...args: unknown[]) =>
		invalidateGatewayCreditCacheMock(...args),
}));

vi.mock("../notifications/low-balance", () => ({
	enqueueLowBalanceEmail: vi.fn(),
}));

vi.mock("../notifications/billing-alerts", () => ({
	enqueueAutoTopUpFailedEmail: (...args: unknown[]) => enqueueAutoTopUpFailedEmailMock(...args),
}));

describe("recordUsageAndCharge", () => {
	beforeEach(() => {
		chargeRequestMock.mockReset();
		getLowBalanceStateMock.mockReset().mockResolvedValue(null);
		invalidateGatewayCreditCacheMock.mockReset();
		releaseRuntimeMock.mockReset();
		enqueueAutoTopUpFailedEmailMock.mockReset().mockResolvedValue(true);
		process.env.STRIPE_SECRET_KEY = "sk_test_example";
	});

	it("invalidates the workspace credit cache after a successful new charge", async () => {
		chargeRequestMock.mockResolvedValue({ status: "charged", applied: true, already_applied: false });
		const { recordUsageAndCharge } = await import("./persist");

		await recordUsageAndCharge({
			requestId: "req_123",
			workspaceId: "workspace_123",
			cost_nanos: 123,
		});

		expect(invalidateGatewayCreditCacheMock).toHaveBeenCalledWith("workspace_123");
		expect(releaseRuntimeMock).toHaveBeenCalledTimes(1);
	});

	it("does not invalidate the workspace credit cache for idempotent replays", async () => {
		chargeRequestMock.mockResolvedValue({ status: "charged", already_applied: true });
		const { recordUsageAndCharge } = await import("./persist");

		await recordUsageAndCharge({
			requestId: "req_123",
			workspaceId: "workspace_123",
			cost_nanos: 123,
		});

		expect(invalidateGatewayCreditCacheMock).not.toHaveBeenCalled();
		expect(releaseRuntimeMock).toHaveBeenCalledTimes(1);
	});

	it("queues an owner notification when Auto Top-Up has no payment method", async () => {
		chargeRequestMock.mockResolvedValue({
				status: "top_up_required",
				applied: true,
				already_applied: false,
				auto_top_up_amount_nanos: 25_000_000_000,
				auto_top_up_account_id: null,
				stripe_customer_id: null,
		});
		const { recordUsageAndCharge } = await import("./persist");

		await recordUsageAndCharge({
			requestId: "req_no_card",
			workspaceId: "workspace_123",
			cost_nanos: 123,
		});

		expect(enqueueAutoTopUpFailedEmailMock).toHaveBeenCalledWith({
			workspaceId: "workspace_123",
			dedupeId: expect.stringMatching(/^no_payment_method:workspace_123:\d+$/),
			reason: "No saved payment method is available for Auto Top-Up.",
		});
	});

	it("deduplicates missing payment-method notifications across requests in the cooldown window", async () => {
		chargeRequestMock.mockResolvedValue({
				status: "top_up_required",
				applied: true,
				already_applied: false,
				auto_top_up_amount_nanos: 25_000_000_000,
				auto_top_up_account_id: null,
				stripe_customer_id: null,
		});
		const { recordUsageAndCharge } = await import("./persist");

		await recordUsageAndCharge({ requestId: "req_one", workspaceId: "workspace_123", cost_nanos: 123 });
		await recordUsageAndCharge({ requestId: "req_two", workspaceId: "workspace_123", cost_nanos: 123 });

		const dedupeIds = enqueueAutoTopUpFailedEmailMock.mock.calls.map(([call]) => call.dedupeId);
		expect(dedupeIds).toHaveLength(2);
		expect(dedupeIds[0]).toBe(dedupeIds[1]);
	});
});
