import { describe, expect, it } from "vitest";
import { ChatCompletionsSchema } from "@core/schemas";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import { irToOpenAIChat, openAIChatToIR } from "@executors/_shared/text-generate/openai-compat/transform-chat";
import { preprocess } from "./index";

describe.each(["arcee", "arcee-ai"])("%s text contract", (providerId) => {
	it("preserves documented n, tools, structured output, and reasoning effort", () => {
		const decoded = decodeOpenAIChatRequest(ChatCompletionsSchema.parse({
			model: "arcee-ai/trinity-large",
			messages: [{ role: "user", content: "hello" }],
			n: 2,
			reasoning_effort: "max",
			tools: [{ type: "function", function: { name: "lookup", parameters: { type: "object" } } }],
			tool_choice: "auto",
			response_format: { type: "json_schema", json_schema: { name: "answer", schema: { type: "object", properties: { answer: { type: "string" } } } } },
		}));
		const filtered = preprocess(decoded, { capabilityParams: null } as any);
		const wire = irToOpenAIChat(filtered, "trinity-large-preview", providerId);
		expect(wire).toMatchObject({
			n: 2,
			reasoning_effort: "high",
			tool_choice: "auto",
			response_format: { type: "json_schema" },
		});
	});

	it("normalizes Arcee reasoning and usage into the IR", () => {
		const response = openAIChatToIR({
			id: "chat_arcee_1",
			model: "trinity-mini",
			choices: [{ index: 0, message: { role: "assistant", reasoning: "2 + 2", content: "4" }, finish_reason: "stop" }],
			usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
		}, "req_arcee", "trinity-mini", providerId);
		expect(response.choices[0]?.message.content).toEqual([
			{ type: "reasoning_text", text: "2 + 2" },
			{ type: "text", text: "4" },
		]);
		expect(response.usage).toMatchObject({ inputTokens: 5, outputTokens: 2, totalTokens: 7 });
	});
});
