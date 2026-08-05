import type { PipelineContext } from "../before/types";
import type { RequestResult } from "../execute";
import { shapeUsageForClient } from "../usage";

export function applySuccessfulResponseBillingPolicy(args: {
	endpoint: string;
	pricedUsage: any;
	totalNanos: number;
	totalCents: number;
}): { pricedUsage: any; totalNanos: number; totalCents: number; billingSuppressed: boolean } {
	const isTextGeneration =
		args.endpoint === "chat.completions" ||
		args.endpoint === "responses" ||
		args.endpoint === "messages";
	const outputTokens = Number(
		args.pricedUsage?.output_tokens ??
		args.pricedUsage?.completion_tokens ??
		args.pricedUsage?.output_text_tokens ??
		NaN,
	);
	const toolCalls = Number(
		args.pricedUsage?.output_tool_call_count ??
		args.pricedUsage?.tool_call_count ??
		0,
	);
	const hasNonTextOrServerToolOutput = Object.entries(args.pricedUsage ?? {}).some(([key, value]) =>
		(
			key.startsWith("output_image") ||
			key.startsWith("output_audio") ||
			key.startsWith("output_video") ||
			key.startsWith("server_tool_") ||
			key.startsWith("native_web_")
		) && typeof value === "number" && Number.isFinite(value) && value > 0
	);
	const suppress = isTextGeneration && outputTokens === 0 && toolCalls <= 0 && !hasNonTextOrServerToolOutput;
	if (!suppress) {
		return {
			pricedUsage: args.pricedUsage,
			totalNanos: args.totalNanos,
			totalCents: args.totalCents,
			billingSuppressed: false,
		};
	}
	const pricing = args.pricedUsage?.pricing;
	const byokBilling = args.pricedUsage?.byok_billing;
	return {
		pricedUsage: pricing && typeof pricing === "object"
			? {
				...args.pricedUsage,
				...(byokBilling && typeof byokBilling === "object"
					? {
						byok_billing: {
							...byokBilling,
							fee_applied: false,
							fee_nanos: 0,
							charged_nanos: 0,
						},
					}
					: {}),
				pricing: {
					...pricing,
					subtotal_nanos: Math.max(0, Math.round(args.totalNanos)),
					total_nanos: 0,
					total_cents: 0,
					total_usd_str: "0.000000000",
					lines: [],
					billing_suppressed: true,
					billing_suppression_reason: "zero_output_tokens",
				},
			}
			: args.pricedUsage,
		totalNanos: 0,
		totalCents: 0,
		billingSuppressed: true,
	};
}

export function suppressFailedResponseBilling(args: {
	ctx: PipelineContext;
	result: RequestResult;
	usage?: unknown;
	reason: "upstream_failure" | "incomplete_stream" | "empty_response";
}): void {
	const rawUsage = args.usage ?? {
		...((args.result.bill?.usage && typeof args.result.bill.usage === "object") ? args.result.bill.usage : {}),
		...((args.result.ir?.usage && typeof args.result.ir.usage === "object") ? args.result.ir.usage : {}),
	};
	const shaped = shapeUsageForClient(rawUsage, {
		endpoint: args.ctx.endpoint,
		body: args.ctx.body,
		includeInternalHints: true,
	});
	const usageForAudit = shaped && typeof shaped === "object" ? { ...shaped } : {};
	delete (usageForAudit as any)._provider_id;
	(usageForAudit as any).pricing = {
		total_nanos: 0,
		total_cents: 0,
		total_usd_str: "0.000000000",
		currency: args.result.bill.currency ?? "USD",
		lines: [],
		billing_suppressed: true,
		billing_suppression_reason: args.reason,
	};
	args.result.bill.cost_cents = 0;
	args.result.bill.currency = args.result.bill.currency ?? "USD";
	args.result.bill.usage = usageForAudit;
}
