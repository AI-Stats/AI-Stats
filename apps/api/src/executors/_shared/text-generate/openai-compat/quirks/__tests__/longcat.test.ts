import { describe, expect, it } from "vitest";
import { irToOpenAIChat, openAIChatToIR } from "../../transform-chat";
import { longCatQuirks } from "../../providers/longcat/quirks";

describe("LongCat quirks", () => {
	it("maps IR reasoning to thinking.type and removes unsupported fields", () => {
		const request = irToOpenAIChat({
			model: "meituan/longcat-2.0",
			messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
			stream: false,
			maxTokens: 1024,
			temperature: 0.7,
			topP: 0.9,
			reasoning: { enabled: true },
			tools: [{ name: "unsupported", type: "function", parameters: {} }],
			responseFormat: { type: "json_object" },
			streamOptions: { include_usage: true },
		} as any, "LongCat-2.0", "longcat");

		expect(request).toMatchObject({
			model: "LongCat-2.0",
			max_tokens: 1024,
			temperature: 0.7,
			top_p: 0.9,
			thinking: { type: "enabled" },
		});
		expect(request.tools).toBeUndefined();
		expect(request.response_format).toBeUndefined();
		expect(request.stream_options).toBeUndefined();
	});

	it("maps disabled reasoning and extracts buffered reasoning_content", () => {
		const request: Record<string, any> = { reasoning_effort: "none" };
		longCatQuirks.transformRequest?.({
			request,
			ir: { reasoning: { enabled: false } } as any,
		});
		expect(request).toEqual({ thinking: { type: "disabled" } });

		const ir = openAIChatToIR({
			id: "chatcmpl_longcat",
			choices: [{
				index: 0,
				message: { content: "answer", reasoning_content: "working" },
				finish_reason: "stop",
			}],
			usage: {
				prompt_tokens: 20,
				completion_tokens: 15,
				total_tokens: 35,
				completion_tokens_details: { reasoning_tokens: 78 },
			},
		}, "req_longcat", "meituan/longcat-2.0", "longcat");
		expect(ir.choices[0].message.content).toEqual([
			{ type: "reasoning_text", text: "working" },
			{ type: "text", text: "answer" },
		]);
		expect(ir.usage).toMatchObject({ inputTokens: 20, outputTokens: 15, totalTokens: 35, reasoningTokens: 78 });
	});
});
