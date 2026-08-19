import { describe, expect, it } from "vitest";
import { ChatCompletionsSchema } from "@core/schemas";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import {
	irToOpenAIChat,
	openAIChatToIR,
} from "@executors/_shared/text-generate/openai-compat/transform-chat";
import { cloudflareQuirks } from "@executors/_shared/text-generate/openai-compat/providers/cloudflare/quirks";

describe("Cloudflare Workers AI text contract", () => {
	it("maps Kimi reasoning to Workers AI's current thinking field", () => {
		const ir = decodeOpenAIChatRequest(ChatCompletionsSchema.parse({
			model: "@cf/moonshotai/kimi-k2.6",
			messages: [{ role: "user", content: "Solve this" }],
			reasoning_effort: "high",
			tools: [{ type: "function", function: { name: "lookup", parameters: { type: "object" } } }],
			response_format: {
				type: "json_schema",
				json_schema: { name: "answer", strict: true, schema: { type: "object" } },
			},
		}));
		const wire = irToOpenAIChat(ir, "@cf/moonshotai/kimi-k2.6", "cloudflare");
		expect(wire).toMatchObject({
			model: "@cf/moonshotai/kimi-k2.6",
			reasoning_effort: "high",
			chat_template_kwargs: { thinking: "high" },
			response_format: { type: "json_schema" },
		});
		expect(wire.tools).toHaveLength(1);
	});

	it("normalizes Kimi's reasoning response and standard usage", () => {
		const response = openAIChatToIR({
			id: "chatcmpl-cf",
			model: "@cf/moonshotai/kimi-k2.6",
			choices: [{ index: 0, message: { role: "assistant", reasoning: "work", content: "answer" }, finish_reason: "stop" }],
			usage: { prompt_tokens: 8, completion_tokens: 5, total_tokens: 13 },
		}, "request-cf", "@cf/moonshotai/kimi-k2.6", "cloudflare");
		expect(response.choices[0]?.message.content).toEqual([
			{ type: "reasoning_text", text: "work" },
			{ type: "text", text: "answer" },
		]);
		expect(response.usage).toMatchObject({ inputTokens: 8, outputTokens: 5, totalTokens: 13 });
	});

	it("normalizes streamed Kimi reasoning deltas", () => {
		const chunk = { choices: [{ delta: { reasoning: "step" } }] };
		cloudflareQuirks.transformStreamChunk?.({ chunk, accumulated: {} });
		expect(chunk.choices[0].delta).toMatchObject({ reasoning_content: "step" });
	});
});
