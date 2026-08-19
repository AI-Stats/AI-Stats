import { describe, expect, it } from "vitest";
import { irToOpenAIChat } from "../../transform-chat";

describe("Friendli chat request mapping", () => {
	it("preserves supported sampling, multi-choice, tool, structured, and reasoning controls", () => {
		const request = irToOpenAIChat({
			model: "friendli/zai-org/GLM-5.2",
			messages: [
				{ role: "developer", content: [{ type: "text", text: "Return JSON." }] },
				{ role: "user", content: [{ type: "text", text: "Give a city." }] },
			],
			stream: true,
			topK: 40,
			repetitionPenalty: 1.1,
			parallelToolCalls: false,
			reasoning: { effort: "high", maxTokens: 1024 },
			responseFormat: { type: "json_object" },
			vendor: { friendli: { n: 2 } },
		} as any, "zai-org/GLM-5.2", "friendli");

		expect(request.messages[0].role).toBe("system");
		expect(request.top_k).toBe(40);
		expect(request.repetition_penalty).toBe(1.1);
		expect(request.parallel_tool_calls).toBe(false);
		expect(request.reasoning_effort).toBe("high");
		expect(request.reasoning_budget).toBe(1024);
		expect(request.response_format).toEqual({ type: "json_object" });
		expect(request.n).toBe(2);
	});
});
