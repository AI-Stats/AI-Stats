import { describe, expect, it } from "vitest";
import { ChatCompletionsSchema } from "@core/schemas";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import { irToOpenAIChat } from "../../transform-chat";
import { infermaticQuirks } from "../../providers/infermatic/quirks";

describe("Infermatic quirks", () => {
	it("preserves documented generation controls and removes unsupported extensions", () => {
		const parsed = ChatCompletionsSchema.parse({
			model: "infermatic/Sao10K-72B-Qwen2.5-Kunou-v1-FP8-Dynamic",
			messages: [{ role: "user", content: "hello" }],
			max_tokens: 7000,
			temperature: 0.7,
			top_p: 0.9,
			top_k: -1,
			min_p: 0.1,
			repetition_penalty: 1.2,
			n: 2,
			tools: [{ type: "function", function: { name: "lookup", parameters: {} } }],
			response_format: { type: "json_object" },
			reasoning_effort: "high",
			stream_options: { include_usage: true },
		});
		const ir = decodeOpenAIChatRequest(parsed as any);
		const request = irToOpenAIChat(ir, "Sao10K-72B-Qwen2.5-Kunou-v1-FP8-Dynamic", "infermatic");

		expect(request).toMatchObject({
			max_tokens: 7000,
			temperature: 0.7,
			top_p: 0.9,
			top_k: -1,
			min_p: 0.1,
			repetition_penalty: 1.2,
		});
		for (const field of ["tools", "response_format", "reasoning_effort", "stream_options"]) {
			expect(request[field]).toBeUndefined();
		}
	});

	it("does not alter standard OpenAI response handling", () => {
		const request = { model: "model", messages: [], stream: true };
		infermaticQuirks.transformRequest?.({ request, ir: {} as any });
		expect(request).toEqual({ model: "model", messages: [], stream: true });
	});
});
