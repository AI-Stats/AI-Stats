import { describe, expect, it } from "vitest";
import { inceptionQuirks } from "../../providers/inception/quirks";
import { ChatCompletionsSchema } from "@core/schemas";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import { irToOpenAIChat, openAIChatToIR } from "../../transform-chat";

describe("Inception quirks", () => {
	it("maps IR reasoning to top-level Inception fields", () => {
		const request: Record<string, any> = {
			model: "mercury-2",
			messages: [{ role: "user", content: "hello" }],
		};

		inceptionQuirks.transformRequest?.({
			request,
			ir: {
				reasoning: {
					effort: "instant",
					summary: "concise",
				},
				vendor: {
					inception: {
						reasoning_summary: true,
						reasoning_summary_wait: true,
						diffusing: false,
						realtime: true,
					},
				},
			} as any,
		});

		expect(request.reasoning_effort).toBe("instant");
		expect(request.reasoning_summary).toBe(true);
		expect(request.reasoning_summary_wait).toBe(true);
		expect(request.diffusing).toBe(false);
		expect(request.realtime).toBe(true);
		expect(request.reasoning).toBeUndefined();
	});

	it("extracts reasoning_content", () => {
		const extracted = inceptionQuirks.extractReasoning?.({
			rawContent: "Final answer",
			choice: {
				message: {
					content: "Final answer",
					reasoning_content: "internal reasoning",
				},
			},
		});

		expect(extracted).toEqual({
			main: "Final answer",
			reasoning: ["internal reasoning"],
		});
	});

	it("accepts the official instant/realtime request and preserves boolean summary controls", () => {
		const parsed = ChatCompletionsSchema.parse({
			model: "inception/mercury-2",
			messages: [{ role: "user", content: "Hello" }],
			reasoning_effort: "instant",
			reasoning_summary: true,
			reasoning_summary_wait: true,
			realtime: true,
			diffusing: true,
		});
		const ir = decodeOpenAIChatRequest(parsed);
		const request = irToOpenAIChat(ir, "mercury-2", "inception");

		expect(request.reasoning_effort).toBe("instant");
		expect(request.reasoning_summary).toBe(true);
		expect(request.reasoning_summary_wait).toBe(true);
		expect(request.realtime).toBe(true);
		expect(request.diffusing).toBe(true);
	});

	it("normalizes Inception top-level cached and reasoning token usage", () => {
		const ir = openAIChatToIR({
			id: "chatcmpl_inception",
			model: "mercury-2",
			choices: [{ index: 0, message: { role: "assistant", content: "done" }, finish_reason: "stop" }],
			usage: {
				prompt_tokens: 20,
				completion_tokens: 8,
				total_tokens: 28,
				reasoning_tokens: 3,
				cached_input_tokens: 10,
			},
		}, "req_inception", "mercury-2", "inception");

		expect(ir.usage?.cachedInputTokens).toBe(10);
		expect(ir.usage?.cachedReadTokensAreSubsetOfInput).toBe(true);
		expect(ir.usage?.reasoningTokens).toBe(3);
	});

	it("surfaces Inception's top-level reasoning summary in chat IR", () => {
		const response: any = {
			reasoning_summary: { status: "complete", content: "Short rationale" },
			choices: [{ message: { content: "Answer" } }],
		};
		inceptionQuirks.normalizeResponse?.({ response, ir: {} as any });
		expect(response.choices[0].message.reasoning_content).toBe("Short rationale");

		const chunk: any = {
			reasoning_summary: { status: "complete", content: "Stream rationale" },
			choices: [{ delta: {}, finish_reason: "stop" }],
		};
		inceptionQuirks.transformStreamChunk?.({ chunk, accumulated: {} });
		expect(chunk.choices[0].delta.reasoning_content).toBe("Stream rationale");
	});
});
