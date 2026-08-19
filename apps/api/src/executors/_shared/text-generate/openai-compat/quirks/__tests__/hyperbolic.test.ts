import { describe, expect, it } from "vitest";
import { ChatCompletionsSchema } from "@core/schemas";
import { hyperbolicQuirks } from "../../providers/hyperbolic/quirks";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import { irToOpenAIChat } from "../../transform-chat";

describe("Hyperbolic quirks", () => {
	it("keeps documented Chat parameters and removes unsupported extensions", () => {
		const request: Record<string, any> = {
			model: "deepseek-ai/DeepSeek-R1",
			messages: [{ role: "user", content: "hello" }],
			max_tokens: 512,
			temperature: 0.5,
			top_p: 0.9,
			top_k: -1,
			min_p: 0.1,
			repetition_penalty: 1.1,
			tools: [{ type: "function" }],
			response_format: { type: "json_object" },
			reasoning_effort: "high",
			service_tier: "priority",
			stream_options: { include_usage: true },
		};

		hyperbolicQuirks.transformRequest?.({ request, ir: {} as any });

		expect(request).toMatchObject({
			max_tokens: 512,
			temperature: 0.5,
			top_p: 0.9,
			top_k: -1,
			min_p: 0.1,
			repetition_penalty: 1.1,
		});
		for (const field of ["tools", "response_format", "reasoning_effort", "service_tier", "stream_options"]) {
			expect(request[field]).toBeUndefined();
		}
	});

	it("accepts Hyperbolic's documented top_k=-1 sentinel", () => {
		const parsed = ChatCompletionsSchema.safeParse({
			model: "hyperbolic/deepseek-ai/DeepSeek-R1",
			messages: [{ role: "user", content: "hello" }],
			top_k: -1,
		});
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		const ir = decodeOpenAIChatRequest({ ...parsed.data, min_p: 0.15, repetition_penalty: 1.1 } as any);
		expect(ir).toMatchObject({ topK: -1, minP: 0.15, repetitionPenalty: 1.1 });
		expect(irToOpenAIChat(ir, "deepseek-ai/DeepSeek-R1", "hyperbolic")).toMatchObject({
			top_k: -1,
			min_p: 0.15,
			repetition_penalty: 1.1,
		});
	});
});
