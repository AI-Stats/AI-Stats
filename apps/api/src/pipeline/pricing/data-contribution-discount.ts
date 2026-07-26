export const DATA_CONTRIBUTION_DEFAULT_DISCOUNT_BPS = 100;

export type DataContributionDiscountResult = {
	pricedUsage: any;
	totalCents: number;
	totalNanos: number;
	discountNanos: number;
};

function boundedBasisPoints(value: unknown, fallback: number): number {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return fallback;
	return Math.max(0, Math.min(10_000, Math.trunc(numeric)));
}

/**
 * Applies the contribution discount after provider pricing and before wallet
 * charging. BYOK requests are excluded because their charge is a service fee,
 * not model resale pricing.
 */
export function applyDataContributionDiscount(args: {
	pricedUsage: any;
	totalNanos: number;
	enabled: boolean;
	isByok: boolean;
	discountBps?: number | null;
}): DataContributionDiscountResult {
	const subtotalNanos = Math.max(0, Math.round(Number(args.totalNanos) || 0));
	const discountBps = boundedBasisPoints(
		args.discountBps,
		DATA_CONTRIBUTION_DEFAULT_DISCOUNT_BPS,
	);
	const eligible = args.enabled && !args.isByok && subtotalNanos > 0 && discountBps > 0;
	if (!eligible) {
		return {
			pricedUsage: args.pricedUsage,
			totalCents: Math.ceil(subtotalNanos / 10_000_000),
			totalNanos: subtotalNanos,
			discountNanos: 0,
		};
	}
	const discountNanos = eligible
		? Math.min(subtotalNanos, Math.floor((subtotalNanos * discountBps) / 10_000))
		: 0;
	const totalNanos = subtotalNanos - discountNanos;
	const pricing = args.pricedUsage?.pricing;
	const sourceLines = Array.isArray(pricing?.lines) ? pricing.lines : [];
	let allocatedDiscount = 0;
	const discountedLines = sourceLines.map((line: any, index: number) => {
		const baseLineNanos = Math.max(0, Math.round(Number(line?.line_nanos) || 0));
		const lineDiscount = eligible
			? index === sourceLines.length - 1
				? Math.min(baseLineNanos, Math.max(0, discountNanos - allocatedDiscount))
				: Math.min(baseLineNanos, Math.floor((baseLineNanos * discountNanos) / Math.max(1, subtotalNanos)))
			: 0;
		allocatedDiscount += lineDiscount;
		const lineNanos = baseLineNanos - lineDiscount;
		const baseUnitPrice = Number(line?.unit_price_usd);
		return {
			...line,
			line_nanos: lineNanos,
			line_cost_usd: (lineNanos / 1_000_000_000).toFixed(9),
			unit_price_usd: Number.isFinite(baseUnitPrice)
				? (baseUnitPrice * (1 - (eligible ? discountBps / 10_000 : 0))).toFixed(9)
				: line?.unit_price_usd,
			base_line_nanos: baseLineNanos,
			base_line_cost_usd: line?.line_cost_usd,
			base_unit_price_usd: line?.unit_price_usd,
			data_contribution_discount_nanos: lineDiscount,
		};
	});
	const pricedUsage = pricing && typeof pricing === "object"
		? {
			...args.pricedUsage,
			pricing: {
				...pricing,
				total_nanos: totalNanos,
				total_cents: Math.ceil(totalNanos / 10_000_000),
				total_usd_str: (totalNanos / 1_000_000_000).toFixed(9),
				lines: discountedLines,
				data_contribution_eligible: eligible,
				data_contribution_discount_bps: eligible ? discountBps : 0,
				data_contribution_discount_nanos: discountNanos,
				subtotal_nanos: subtotalNanos,
			},
		}
		: args.pricedUsage;

	return {
		pricedUsage,
		totalCents: Math.ceil(totalNanos / 10_000_000),
		totalNanos,
		discountNanos,
	};
}
