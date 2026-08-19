import { describe, expect, it } from "vitest";
import { irToOpenAIChat } from "../../transform-chat";
import { openAIChatToIR } from "../../transform-chat";

describe("Weights & Biases chat quirks", () => {
	it.each([
		[{ enabled: true }, true],
		[{ enabled: false }, false],
		[{ effort: "high" }, true],
		[{ effort: "none" }, false],
	])("maps IR reasoning %j to chat_template_kwargs", (reasoning, enabled) => {
		const request = irToOpenAIChat({
			model: "google/gemma-4-31B-it",
			messages: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
			reasoning: reasoning as any,
			stream: false,
		}, "google/gemma-4-31B-it", "weights-and-biases");

		expect(request.chat_template_kwargs).toEqual({ enable_thinking: enabled });
	});

	it("normalizes W&B reasoning response fields", () => {
		const response = openAIChatToIR({
			id: "chatcmpl-wandb",
			created: 1,
			model: "google/gemma-4-31B-it",
			choices: [{
				index: 0,
				message: { role: "assistant", content: "Four", reasoning: "Two plus two." },
				finish_reason: "stop",
			}],
			usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
		}, "req-wandb", "google/gemma-4-31B-it", "weights-and-biases");

		expect(response.choices[0]?.message.content).toEqual([
			{ type: "reasoning_text", text: "Two plus two." },
			{ type: "text", text: "Four" },
		]);
		expect(response.usage).toMatchObject({ inputTokens: 2, outputTokens: 3, totalTokens: 5 });
	});
});
