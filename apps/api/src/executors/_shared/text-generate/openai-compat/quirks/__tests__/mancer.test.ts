import { describe, expect, it } from "vitest";
import { irToOpenAIChat, openAIChatToIR } from "../../transform-chat";
import { mancerQuirks } from "../../providers/mancer/quirks";

describe("Mancer OpenAI compatibility", () => {
	it("preserves documented Mancer extensions and reasoning controls", () => {
		const request = irToOpenAIChat({
			model: "deepseek-v4-flash",
			messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
			stream: false,
			reasoning: { enabled: false },
			rawRequest: {
				n: 2,
				respond_as: { role: "continue" },
				min_tokens: 12,
				custom_token_bans: [1, 2],
				dynatemp_mode: 1,
				dry_multiplier: 0.8,
				custom_timeout: 30,
				allow_logging: false,
			},
		}, "deepseek-v4-flash", "mancer");

		expect(request).toMatchObject({
			n: 2,
			respond_as: { role: "continue" },
			min_tokens: 12,
			custom_token_bans: [1, 2],
			dynatemp_mode: 1,
			dry_multiplier: 0.8,
			custom_timeout: 30,
			allow_logging: false,
			reasoning: { enabled: false },
		});
	});

	it("does not forward tool choices that Mancer rejects", () => {
		const request = irToOpenAIChat({
			model: "deepseek-v4-flash",
			messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
			stream: false,
			toolChoice: "required",
		}, "deepseek-v4-flash", "mancer");
		expect(request).not.toHaveProperty("tool_choice");
	});

	it("turns cumulative Mancer stream meters into OpenAI usage", () => {
		const chunk: Record<string, unknown> = {
			"x-input-tokens": 7,
			"x-output-tokens": 3,
			"x-spent-credits": 11,
		};
		mancerQuirks.transformStreamChunk?.({ chunk, accumulated: {} });
		expect(chunk.usage).toEqual({
			prompt_tokens: 7,
			completion_tokens: 3,
			total_tokens: 10,
			"x-spent-credits": 11,
		});
	});

	it.each(["custom_timeout", "constraint", "aborted", "error"])(
		"maps %s to an unsuccessful IR finish reason",
		(finishReason) => {
			const response = openAIChatToIR({
				id: "chatcmpl-mancer",
				model: "deepseek-v4-flash",
				choices: [{ index: 0, message: { role: "assistant", content: "partial" }, finish_reason: finishReason }],
				usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6, "x-spent-credits": 9 },
			}, "request-1", "deepseek-v4-flash", "mancer");

			expect(response.choices[0]?.finishReason).toBe("error");
			expect(response.usage).toMatchObject({ inputTokens: 4, outputTokens: 2, totalTokens: 6 });
			expect(response.usage?._ext?.spentCredits).toBe(9);
		},
	);
});
