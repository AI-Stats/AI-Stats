import { describe, expect, it } from "vitest";
import { cohereQuirks } from "../../providers/cohere/quirks";

describe("Cohere quirks", () => {
	it("drops unsupported chat fields", () => {
		const request: Record<string, any> = {
			stream_options: { include_usage: true },
			store: true,
			metadata: { source: "test" },
			logit_bias: { 42: 1 },
			top_logprobs: 3,
			n: 2,
			modalities: ["text"],
			prediction: { type: "content", content: "hello" },
			audio: { voice: "alloy" },
			service_tier: "default",
			parallel_tool_calls: true,
			tool_choice: "auto",
			logprobs: true,
			repetition_penalty: 1.1,
			top_k: 20,
			user: "user-1",
			prompt_cache_key: "cache-1",
			web_search_options: {},
		};

		cohereQuirks.transformRequest?.({ request, ir: {} as any });

		expect(request.stream_options).toBeUndefined();
		expect(request.store).toBeUndefined();
		expect(request.metadata).toBeUndefined();
		expect(request.logit_bias).toBeUndefined();
		expect(request.top_logprobs).toBeUndefined();
		expect(request.n).toBeUndefined();
		expect(request.modalities).toBeUndefined();
		expect(request.prediction).toBeUndefined();
		expect(request.audio).toBeUndefined();
		expect(request.service_tier).toBeUndefined();
		expect(request.parallel_tool_calls).toBeUndefined();
		expect(request.tool_choice).toBeUndefined();
		expect(request.logprobs).toBeUndefined();
		expect(request.repetition_penalty).toBeUndefined();
		expect(request.top_k).toBeUndefined();
		expect(request.user).toBeUndefined();
		expect(request.prompt_cache_key).toBeUndefined();
		expect(request.web_search_options).toBeUndefined();
	});

	it("maps reasoning effort to Cohere-supported values", () => {
		const request: Record<string, any> = {};

		cohereQuirks.transformRequest?.({
			request,
			ir: { reasoning: { effort: "medium" } } as any,
		});

		expect(request.reasoning_effort).toBe("high");
	});

	it("maps reasoning enabled false to none", () => {
		const request: Record<string, any> = {};

		cohereQuirks.transformRequest?.({
			request,
			ir: { reasoning: { enabled: false } } as any,
		});

		expect(request.reasoning_effort).toBe("none");
	});

	it("drops OpenAI nested reasoning payload", () => {
		const request: Record<string, any> = {
			reasoning: { effort: "high" },
		};

		cohereQuirks.transformRequest?.({
			request,
			ir: { reasoning: { effort: "high" } } as any,
		});

		expect(request.reasoning).toBeUndefined();
		expect(request.reasoning_effort).toBe("high");
	});
});
