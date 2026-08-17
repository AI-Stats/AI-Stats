import Stripe from "stripe";

jest.mock("@/lib/stripe", () => ({
	getStripe: jest.fn(),
}));

jest.mock("@/lib/billing/walletRepository", () => ({
	applyPaymentIntentCredit: jest.fn(),
	applyWalletDelta: jest.fn(),
}));

jest.mock("@/lib/database/repositories/billing", () => ({
	createPaymentIntentProcessingLedger: jest.fn(),
	enqueueAutoTopUpFailure: jest.fn(),
	findLedgerEntry: jest.fn(),
	getWalletBalance: jest.fn(),
	getWorkspaceTier: jest.fn(),
	markPaymentIntentFailed: jest.fn(),
	markRefundLedgerSucceeded: jest.fn(),
	resolveWalletAttribution: jest.fn(),
	syncRefundLedger: jest.fn(),
	updateRefundStatus: jest.fn(),
}));

jest.mock("@/lib/automations/resend-events", () => ({
	deriveFirstName: (value: string | null | undefined) => String(value ?? "").split(" ")[0],
	sendCreditsPurchasedEvent: jest.fn(),
}));

jest.mock("@/lib/automations/billingDiscord", () => ({ sendBillingDiscordWebhook: jest.fn() }));

import { POST } from "./route";
import { getStripe } from "@/lib/stripe";
import { applyPaymentIntentCredit } from "@/lib/billing/walletRepository";
import { getWorkspaceTier, resolveWalletAttribution } from "@/lib/database/repositories/billing";
import { sendCreditsPurchasedEvent } from "@/lib/automations/resend-events";
import { sendBillingDiscordWebhook } from "@/lib/automations/billingDiscord";

const mockGetStripe = jest.mocked(getStripe);
const mockApplyPaymentIntentCredit = jest.mocked(applyPaymentIntentCredit);
const mockResolveWalletAttribution = jest.mocked(resolveWalletAttribution);
const mockGetWorkspaceTier = jest.mocked(getWorkspaceTier);
const mockSendCreditsPurchasedEvent = jest.mocked(sendCreditsPurchasedEvent);
const mockSendBillingDiscordWebhook = jest.mocked(sendBillingDiscordWebhook);
const mockCustomersRetrieve = jest.fn();
const mockCheckoutSessionsList = jest.fn();
const stripeForSignatures = new Stripe("sk_test_namespace_audit", { apiVersion: "2026-06-24.dahlia" });

const webhookSecret = "whsec_namespace_audit";
const workspaceId = "6108396e-0e12-425d-91ff-a02d39a346e0";

function signedRequest(event: Record<string, unknown>) {
	const payload = JSON.stringify(event);
	const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
	return new Request("https://phaseo.app/api/webhooks/stripe-checkout", {
		method: "POST",
		headers: { "content-type": "application/json", "stripe-signature": signature },
		body: payload,
	});
}

describe("Stripe checkout webhook", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
		delete process.env.STRIPE_TEST_WEBHOOK_SECRET;
		delete process.env.TEST_STRIPE_SECRET_KEY;
		mockGetStripe.mockReturnValue({
			webhooks: stripeForSignatures.webhooks,
			customers: { retrieve: mockCustomersRetrieve, update: jest.fn() },
			checkout: { sessions: { list: mockCheckoutSessionsList } },
			paymentMethods: { attach: jest.fn() },
		} as unknown as Stripe);
		mockResolveWalletAttribution.mockResolvedValue({
			workspaceId,
			stripeCustomerId: "cus_test",
			balanceNanos: 2_000_000_000,
		});
		mockGetWorkspaceTier.mockResolvedValue("free");
		mockApplyPaymentIntentCredit.mockResolvedValue({ applied: true, before_balance_nanos: 2_000_000_000, after_balance_nanos: 6_760_000_000, status: "Paid" });
		mockCustomersRetrieve.mockResolvedValue({ id: "cus_test", email: "person@example.test", name: "Test Person", invoice_settings: {} });
		mockCheckoutSessionsList.mockResolvedValue({ data: [{ id: "cs_test_namespace" }] });
	});

	it("accepts the separately configured sandbox signing secret", async () => {
		process.env.STRIPE_TEST_WEBHOOK_SECRET = "whsec_separate_sandbox";
		process.env.TEST_STRIPE_SECRET_KEY = "sk_test_separate_sandbox";
		const payload = JSON.stringify({
			id: "evt_test_created",
			object: "event",
			livemode: false,
			type: "payment_intent.created",
			data: { object: {
				id: "pi_test_created",
				object: "payment_intent",
				customer: "cus_test",
				metadata: { purpose: "top_up_one_off", workspace_id: workspaceId },
			} },
		});
		const signature = Stripe.webhooks.generateTestHeaderString({
			payload,
			secret: process.env.STRIPE_TEST_WEBHOOK_SECRET,
		});

		const response = await POST(new Request("https://phaseo.app/api/webhooks/stripe-checkout", {
			method: "POST",
			headers: { "stripe-signature": signature },
			body: payload,
		}));

		expect(response.status).toBe(200);
		expect(mockGetStripe).toHaveBeenLastCalledWith({ testMode: true });
	});

	it("verifies a signed test event and credits the attributed wallet once", async () => {
		const response = await POST(signedRequest({
			id: "evt_test_namespace",
			object: "event",
			type: "payment_intent.succeeded",
			data: { object: {
				id: "pi_test_namespace",
				object: "payment_intent",
				status: "succeeded",
				amount: 500,
				amount_received: 500,
				currency: "usd",
				customer: "cus_test",
				payment_method: null,
				metadata: { purpose: "top_up_one_off", workspace_id: workspaceId },
			} },
		}));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ received: true });
		expect(mockResolveWalletAttribution).toHaveBeenCalledWith({ workspaceId, stripeCustomerId: "cus_test" });
		expect(mockApplyPaymentIntentCredit).toHaveBeenCalledWith(expect.objectContaining({
			workspaceId,
			paymentIntentId: "pi_test_namespace",
			kind: "top_up_one_off",
			amountNanos: 4_000_000_000,
		}));
		expect(mockSendCreditsPurchasedEvent).toHaveBeenCalledTimes(1);
		expect(mockSendBillingDiscordWebhook).toHaveBeenCalledTimes(1);
	});

	it("rejects an invalid Stripe signature before touching the wallet", async () => {
		const response = await POST(new Request("https://phaseo.app/api/webhooks/stripe-checkout", {
			method: "POST",
			headers: { "stripe-signature": "t=1,v1=invalid" },
			body: "{}",
		}));

		expect(response.status).toBe(400);
		expect(mockApplyPaymentIntentCredit).not.toHaveBeenCalled();
	});
});
