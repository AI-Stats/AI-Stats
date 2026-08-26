import { describe, expect, it } from "vitest";
import type { IRChatRequest } from "@core/ir";
import { irToOpenAIChat } from "../../transform-chat";

function request(overrides: Partial<IRChatRequest> = {}): IRChatRequest {
	return {
		model: "mara/MiniMax-M2.7",
		messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
		stream: false,
		...overrides,
	};
}

describe("MARA quirks", () => {
	it("forces JSON Schema strict mode off as required by MARA", () => {
		const transformed = irToOpenAIChat(request({
			responseFormat: {
				type: "json_schema",
				name: "answer",
				schema: { type: "object" },
			},
		}), "MiniMax-M2.7", "mara");

		expect(transformed.response_format).toMatchObject({
			type: "json_schema",
			json_schema: { name: "answer", strict: false },
		});
	});

	it("forwards the documented high reasoning effort for gpt-oss-120b", () => {
		const transformed = irToOpenAIChat(request({
			model: "mara/gpt-oss-120b",
			reasoning: { effort: "high" },
		}), "gpt-oss-120b", "mara");

		expect(transformed.reasoning_effort).toBe("high");
	});

	it("does not claim undocumented reasoning-effort support on other MARA models", () => {
		const transformed = irToOpenAIChat(request({
			reasoning: { effort: "high" },
		}), "MiniMax-M2.7", "mara");

		expect(transformed.reasoning_effort).toBeUndefined();
	});

	it("removes OpenAI parameters MARA documents as ignored", () => {
		const transformed = irToOpenAIChat(request({
			frequencyPenalty: 0.2,
			presencePenalty: 0.3,
			logitBias: { 42: 1 },
			logprobs: true,
			topLogprobs: 3,
			seed: 7,
		}), "MiniMax-M2.7", "mara");

		for (const field of [
			"frequency_penalty", "presence_penalty", "logit_bias",
			"logprobs", "top_logprobs", "seed",
		]) {
			expect(transformed[field]).toBeUndefined();
		}
	});
});
