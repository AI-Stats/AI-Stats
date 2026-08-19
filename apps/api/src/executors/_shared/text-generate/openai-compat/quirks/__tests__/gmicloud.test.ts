import { describe, expect, it } from "vitest";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import { irToOpenAIChat } from "../../transform-chat";

describe("GMI Cloud Chat mapping", () => {
	it("carries documented EOS and context controls through IR", () => {
		const ir = decodeOpenAIChatRequest({
			model: "deepseek-ai/DeepSeek-V4-Pro",
			messages: [{ role: "user", content: "Hello" }],
			provider_options: {
				gmicloud: {
					ignore_eos: true,
					context_length_exceeded_behavior: "error",
				},
			},
		} as any);

		const request = irToOpenAIChat(ir, "deepseek-ai/DeepSeek-V4-Pro", "gmicloud");
		expect(request.ignore_eos).toBe(true);
		expect(request.context_length_exceeded_behavior).toBe("error");
	});
});
