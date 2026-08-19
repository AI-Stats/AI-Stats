import { describe, expect, it } from "vitest";
import { scalewayQuirks } from "../../providers/scaleway/quirks";

describe("Scaleway quirks", () => {
	it("drops unsupported Responses state and built-in/custom tools", () => {
		const request: Record<string, any> = {
			background: true, previous_response_id: "resp_1", metadata: {}, top_logprobs: 3,
			tools: [{ type: "function", name: "lookup" }, { type: "web_search" }, { type: "custom" }],
		};
		scalewayQuirks.transformRequest?.({ request, ir: {} as any });
		expect(request).toEqual({ tools: [{ type: "function", name: "lookup" }] });
	});
});
