export type OutputPerformanceMetrics = {
	effectiveThroughputTps: number | null;
	outputSpeedTps: number | null;
	tpotMs: number | null;
	itlMs: number | null;
	phaseoOverheadMs: number | null;
};

export function calculateOutputPerformanceMetrics(args: {
	outputTokens: number;
	providerDurationMs: number | null;
	providerTtftMs: number | null;
	gatewayE2eMs: number | null;
}): OutputPerformanceMetrics {
	const outputTokens = Number.isFinite(args.outputTokens)
		? Math.max(0, args.outputTokens)
		: 0;
	const providerDurationMs =
		args.providerDurationMs != null && Number.isFinite(args.providerDurationMs)
			? Math.max(0, args.providerDurationMs)
			: null;
	const providerTtftMs =
		args.providerTtftMs != null && Number.isFinite(args.providerTtftMs)
			? Math.max(0, args.providerTtftMs)
			: null;
	const gatewayE2eMs =
		args.gatewayE2eMs != null && Number.isFinite(args.gatewayE2eMs)
			? Math.max(0, args.gatewayE2eMs)
			: null;
	const postFirstTokenMs =
		providerDurationMs != null && providerTtftMs != null
			? Math.max(0, providerDurationMs - providerTtftMs)
			: null;
	const postFirstTokenCount = Math.max(0, outputTokens - 1);
	const tpotMs =
		postFirstTokenMs != null && postFirstTokenMs > 0 && postFirstTokenCount > 0
			? postFirstTokenMs / postFirstTokenCount
			: null;

	return {
		effectiveThroughputTps:
			providerDurationMs != null && providerDurationMs > 0 && outputTokens > 0
				? outputTokens / (providerDurationMs / 1000)
				: null,
		outputSpeedTps:
			tpotMs != null && tpotMs > 0 ? 1000 / tpotMs : null,
		tpotMs,
		// Without token-level timestamps, mean ITL and TPOT share this estimator.
		itlMs: tpotMs,
		phaseoOverheadMs:
			gatewayE2eMs != null && providerDurationMs != null
				? Math.max(0, gatewayE2eMs - providerDurationMs)
				: null,
	};
}
