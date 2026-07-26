import { describe, expect, it } from "vitest";
import { applySuccessfulResponseBillingPolicy, suppressFailedResponseBilling } from "./billing-policy";

describe("suppressFailedResponseBilling", () => {
	it("preserves observed usage for audit but forces the customer charge to zero", () => {
		const result: any = {
			bill: {
				cost_cents: 12,
				currency: "USD",
				usage: { input_tokens: 120, output_tokens: 0, pricing: { total_nanos: 120_000_000 } },
			},
			ir: { usage: { input_tokens: 120, output_tokens: 0 } },
		};
		suppressFailedResponseBilling({
			ctx: { endpoint: "responses", body: {} } as any,
			result,
			reason: "empty_response",
		});
		expect(result.bill.cost_cents).toBe(0);
		expect(result.bill.usage).toMatchObject({
			input_tokens: 120,
			output_tokens: 0,
			pricing: {
				total_nanos: 0,
				lines: [],
				billing_suppressed: true,
				billing_suppression_reason: "empty_response",
			},
		});
	});

	it("does not bill a text generation with explicitly zero output tokens", () => {
		const result = applySuccessfulResponseBillingPolicy({
			endpoint: "responses",
			pricedUsage: { input_tokens: 120, output_tokens: 0, pricing: { total_nanos: 120_000_000, lines: [{ line_nanos: 120_000_000 }] } },
			totalNanos: 120_000_000,
			totalCents: 12,
		});
		expect(result).toMatchObject({ totalNanos: 0, totalCents: 0, billingSuppressed: true });
		expect(result.pricedUsage.pricing).toMatchObject({
			lines: [],
			billing_suppression_reason: "zero_output_tokens",
		});
	});

	it("keeps valid tool and non-text output surfaces billable", () => {
		expect(applySuccessfulResponseBillingPolicy({
			endpoint: "responses",
			pricedUsage: { output_tokens: 0, output_tool_call_count: 1 },
			totalNanos: 50,
			totalCents: 1,
		}).totalNanos).toBe(50);
		expect(applySuccessfulResponseBillingPolicy({
			endpoint: "embeddings",
			pricedUsage: { output_tokens: 0 },
			totalNanos: 50,
			totalCents: 1,
		}).totalNanos).toBe(50);
	});
});
