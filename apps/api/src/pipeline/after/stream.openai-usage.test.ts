import { describe, expect, it, vi } from "vitest";

const auditSuccessMock = vi.fn();
const emitGatewayRequestEventMock = vi.fn();
const recordUsageAndChargeOnceMock = vi.fn();
const onCallEndMock = vi.fn();
const reportProbeResultMock = vi.fn();
const maybeOpenOnRecentErrorsMock = vi.fn();
const maybeWriteStickyRoutingFromUsageMock = vi.fn();
const classifyProviderHealthImpactMock = vi.fn();

vi.mock("../audit", () => ({
	auditSuccess: (...args: any[]) => auditSuccessMock(...args),
	auditFailure: vi.fn(),
}));

vi.mock("@observability/events", () => ({
	emitGatewayRequestEvent: (...args: any[]) => emitGatewayRequestEventMock(...args),
}));

vi.mock("./charge", () => ({
	recordUsageAndChargeOnce: (...args: any[]) => recordUsageAndChargeOnceMock(...args),
}));

vi.mock("../execute/health", () => ({
	classifyProviderHealthImpact: (...args: any[]) => classifyProviderHealthImpactMock(...args),
	onCallEnd: (...args: any[]) => onCallEndMock(...args),
	reportProbeResult: (...args: any[]) => reportProbeResultMock(...args),
	maybeOpenOnRecentErrors: (...args: any[]) => maybeOpenOnRecentErrorsMock(...args),
}));

vi.mock("../execute/sticky-routing", () => ({
	maybeWriteStickyRoutingFromUsage: (...args: any[]) => maybeWriteStickyRoutingFromUsageMock(...args),
	resolveCacheAwareRoutingPreference: () => false,
}));

vi.mock("../pricing/byok-fee", () => ({
	applyByokServiceFee: async ({
		baseCostNanos,
		pricedUsage,
		currencyHint,
	}: {
		baseCostNanos: number;
		pricedUsage: any;
		currencyHint: string;
	}) => ({
		totalCents: Math.round(baseCostNanos / 1e7),
		totalNanos: baseCostNanos,
		currency: currencyHint,
		pricedUsage,
	}),
}));

vi.mock("./pricing", () => ({
	calculatePricing: (usage: any) => ({
		pricedUsage: usage,
		totalCents: 0,
		totalNanos: 0,
		currency: "USD",
	}),
}));

vi.mock("@/runtime/env", () => ({
	ensureRuntimeForBackground: () => () => {},
	dispatchBackground: (promise: Promise<unknown>) => {
		void promise.catch(() => {});
	},
}));

import { handleStreamResponse } from "./stream";

function makeOpenAIStream(): Response {
	const frames = [
		{
			id: "chatcmpl_local_usage_test",
			object: "chat.completion.chunk",
			choices: [{ index: 0, delta: { content: "hello" }, finish_reason: null }],
			usage: null,
		},
		{
			id: "chatcmpl_local_usage_test",
			object: "chat.completion.chunk",
			choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
			usage: null,
		},
		{
			id: "chatcmpl_local_usage_test",
			object: "chat.completion.chunk",
			choices: [],
			usage: { prompt_tokens: 11, completion_tokens: 4, total_tokens: 15 },
		},
	];
	const body = frames
		.map((frame) => `data: ${JSON.stringify(frame)}\n\n`)
		.join("") + "data: [DONE]\n\n";
	return new Response(body, {
		status: 200,
		headers: { "Content-Type": "text/event-stream" },
	});
}

function baseCtx(): any {
	return {
		requestId: "req_local_openai_usage_test",
		workspaceId: "ws_local_test",
		endpoint: "chat.completions",
		protocol: "openai.chat.completions",
		capability: "text.generate",
		model: "openai/gpt-5.6-luna",
		requestedModel: "openai/gpt-5.6-luna",
		stream: true,
		body: { model: "openai/gpt-5.6-luna", stream: true },
		rawBody: { model: "openai/gpt-5.6-luna", stream: true },
		meta: {
			requestId: "req_local_openai_usage_test",
			apiKeyId: "key_local_test",
			authMethod: "api_key",
		},
		providers: [],
		pricing: {},
		gating: {
			key: { ok: true, reason: null, resetAt: null },
			keyLimit: { ok: true, reason: null, resetAt: null },
			credit: { ok: true, reason: null, resetAt: null },
		},
	};
}

describe("handleStreamResponse OpenAI usage finalization", () => {
	it("passes trailing usage-only tokens into charging and persisted audit facts", async () => {
		auditSuccessMock.mockReset().mockResolvedValue(undefined);
		emitGatewayRequestEventMock.mockReset().mockResolvedValue(undefined);
		recordUsageAndChargeOnceMock.mockReset().mockResolvedValue(undefined);
		onCallEndMock.mockReset().mockResolvedValue(undefined);
		reportProbeResultMock.mockReset().mockResolvedValue(undefined);
		maybeOpenOnRecentErrorsMock.mockReset().mockResolvedValue(undefined);
		maybeWriteStickyRoutingFromUsageMock.mockReset().mockResolvedValue(undefined);
		classifyProviderHealthImpactMock.mockReset().mockReturnValue("success");

		const upstream = makeOpenAIStream();
		const response = await handleStreamResponse(
			baseCtx(),
			{
				kind: "stream",
				stream: upstream.body,
				upstream,
				provider: "openai",
				generationTimeMs: 120,
				usageFinalizer: async () => null,
				bill: {
					cost_cents: 0,
					currency: "USD",
					usage: null,
					finish_reason: null,
					upstream_id: "chatcmpl_local_usage_test",
				},
				mappedRequest: null,
				rawResponse: null,
			} as any,
			null,
		);

		const downstream = await response.text();
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(downstream).toContain('"finish_reason":"stop"');
		expect(downstream).toContain('"total_tokens":15');
		expect(recordUsageAndChargeOnceMock).toHaveBeenCalledTimes(1);
		expect(auditSuccessMock).toHaveBeenCalledTimes(1);
		expect(auditSuccessMock.mock.calls[0]?.[0]?.usagePriced).toMatchObject({
			input_tokens: 11,
			output_tokens: 4,
			total_tokens: 15,
		});
	});
});
