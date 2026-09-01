import { emitGatewayBillingAnomaly } from "@/observability/axiom";
import type { PipelineContext } from "../before/types";
import { isFreePriceCard } from "../pricing/free";
import type { PriceCard } from "../pricing/types";

export type BillingIntegrityAnomalyReason =
	| "billable_usage_zero_cost"
	| "priced_lines_zero_total";

function positiveNumber(value: unknown): number {
	const number = Number(value);
	return Number.isFinite(number) && number > 0 ? number : 0;
}

function hasObservedPricedMeter(usage: unknown, card: PriceCard): boolean {
	if (!usage || typeof usage !== "object") return false;
	const record = usage as Record<string, unknown>;
	return card.rules.some((rule) => positiveNumber(record[rule.meter]) > 0);
}

export function classifyZeroCostBillingAnomaly(args: {
	card: PriceCard | null | undefined;
	pricedUsage: unknown;
	costNanos: number;
	isByok: boolean;
}): BillingIntegrityAnomalyReason | null {
	if (!args.card || isFreePriceCard(args.card)) return null;
	if (!Number.isFinite(args.costNanos) || args.costNanos !== 0) return null;

	const pricing = (args.pricedUsage as any)?.pricing;
	if (args.isByok && pricing?.byok_fee_applied === false) return null;
	if (
		positiveNumber(pricing?.subtotal_nanos) > 0 &&
		positiveNumber(pricing?.data_contribution_discount_nanos) >= positiveNumber(pricing?.subtotal_nanos)
	) return null;

	const lines = Array.isArray(pricing?.lines) ? pricing.lines : [];
	if (lines.some((line: any) => positiveNumber(line?.quantity) > 0)) {
		return "priced_lines_zero_total";
	}
	return hasObservedPricedMeter(args.pricedUsage, args.card)
		? "billable_usage_zero_cost"
		: null;
}

export async function reportZeroCostBillingAnomaly(args: {
	ctx: PipelineContext;
	card: PriceCard | null | undefined;
	pricedUsage: unknown;
	costNanos: number;
	endpoint: string;
	provider?: string | null;
	model?: string | null;
	isByok: boolean;
}): Promise<void> {
	const reason = classifyZeroCostBillingAnomaly(args);
	if (!reason || args.ctx.testingMode) return;
	const meta = args.ctx.meta as Record<string, unknown>;
	if (meta.__billingIntegrityAnomalyReported === true) return;
	meta.__billingIntegrityAnomalyReported = true;
	await emitGatewayBillingAnomaly({
		requestId: args.ctx.requestId,
		workspaceId: args.ctx.workspaceId,
		provider: args.provider ?? null,
		model: args.model ?? null,
		endpoint: args.endpoint,
		reason,
		costNanos: args.costNanos,
		usage: args.pricedUsage,
	});
}
