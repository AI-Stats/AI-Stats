import { describe, expect, it } from "vitest";

import { batchPolicyEndpoint, normalizeBatchEndpoint, splitGatewayBatchCreatePayload } from "./batches";

describe("splitGatewayBatchCreatePayload", () => {
	it("strips gateway-only webhook config before proxying upstream", () => {
		expect(
			splitGatewayBatchCreatePayload({
				input_file_id: "file_123",
				endpoint: "/v1/responses",
				model: "openai/gpt-5-mini",
				completion_window: "24h",
				session_id: "session_123",
				webhook: {
					url: "https://example.com/hooks/batch",
					events: ["job.completed"],
				},
			}),
		).toEqual({
			upstreamPayload: {
				input_file_id: "file_123",
				endpoint: "/v1/responses",
				completion_window: "24h",
			},
			webhook: {
				url: "https://example.com/hooks/batch",
				events: ["job.completed"],
			},
			invalidWebhook: false,
		});
	});

	it("returns null webhook when the request does not include one", () => {
		expect(
			splitGatewayBatchCreatePayload({
				input_file_id: "file_123",
				endpoint: "/v1/responses",
				sessionId: "session_456",
			}),
		).toEqual({
			upstreamPayload: {
				input_file_id: "file_123",
				endpoint: "/v1/responses",
			},
			webhook: null,
			invalidWebhook: false,
		});
	});

	it("strips batch requests and preserves webhook endpoint aliases for gateway handling", () => {
		expect(
			splitGatewayBatchCreatePayload({
				requests: [
					{
						custom_id: "row_1",
						body: { model: "gpt-5.4-nano", input: "Hello" },
					},
				],
				endpoint: "/v1/responses",
				webhook_endpoint_id: "we_123",
			}),
		).toEqual({
			upstreamPayload: {
				endpoint: "/v1/responses",
			},
			webhook: {
				endpoint_id: "we_123",
			},
			invalidWebhook: false,
		});
	});

	it("strips prompt shorthand fields before proxying upstream", () => {
		expect(
			splitGatewayBatchCreatePayload({
				model: "openai/gpt-5-mini",
				prompts: ["Summarize this record."],
				system: "Be concise.",
				max_tokens: 256,
				temperature: 0.2,
				webhook_endpoint_id: "we_123",
			}),
		).toEqual({
			upstreamPayload: {},
			webhook: {
				endpoint_id: "we_123",
			},
			invalidWebhook: false,
		});
	});
});

describe("batchPolicyEndpoint", () => {
	it("canonicalizes accepted endpoints and maps Gemini content for guardrails", () => {
		expect(batchPolicyEndpoint("/v1/messages/?trace=1")).toBe("messages");
		expect(batchPolicyEndpoint("https://example.com/v1/generateContent?alt=json")).toBe("responses");
	});

	it("fails closed for unknown endpoints", () => {
		expect(batchPolicyEndpoint("/v1/unknown")).toBeNull();
	});
});

describe("normalizeBatchEndpoint", () => {
	it("canonicalises supported endpoint aliases and absolute URLs", () => {
		expect(normalizeBatchEndpoint("/responses")).toBe("/v1/responses");
		expect(normalizeBatchEndpoint("/v1/chat/completions")).toBe("/v1/chat/completions");
		expect(normalizeBatchEndpoint("https://api.phaseo.app/v1/messages")).toBe("/v1/messages");
		expect(normalizeBatchEndpoint("/v1/embeddings/")).toBe("/v1/embeddings");
		expect(normalizeBatchEndpoint("/completions")).toBe("/v1/completions");
		expect(normalizeBatchEndpoint("/moderations")).toBe("/v1/moderations");
		expect(normalizeBatchEndpoint("/fim/completions")).toBe("/v1/fim/completions");
		expect(normalizeBatchEndpoint("/chat/moderations")).toBe("/v1/chat/moderations");
		expect(normalizeBatchEndpoint("/ocr")).toBe("/v1/ocr");
		expect(normalizeBatchEndpoint("/classifications")).toBe("/v1/classifications");
		expect(normalizeBatchEndpoint("/chat/classifications")).toBe("/v1/chat/classifications");
		expect(normalizeBatchEndpoint("/conversations")).toBe("/v1/conversations");
		expect(normalizeBatchEndpoint("/audio/transcriptions")).toBe("/v1/audio/transcriptions");
		expect(normalizeBatchEndpoint("/images/generations")).toBe("/v1/images/generations");
		expect(normalizeBatchEndpoint("/images/edits")).toBe("/v1/images/edits");
		expect(normalizeBatchEndpoint("/videos")).toBe("/v1/videos");
	});

	it("rejects unknown endpoint shapes", () => {
		expect(normalizeBatchEndpoint("/v1/unknown")).toBeNull();
		expect(normalizeBatchEndpoint(null)).toBeNull();
	});
});
