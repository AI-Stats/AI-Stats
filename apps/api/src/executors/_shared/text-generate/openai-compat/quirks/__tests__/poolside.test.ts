import { describe, expect, it } from "vitest";
import { poolsideQuirks } from "../../providers/poolside/quirks";

describe("Poolside OpenAI-compatible quirks", () => {
	it("maps the gateway reasoning toggle to Poolside's thinking control", () => {
		const request: Record<string, unknown> = {};
		poolsideQuirks.transformRequest?.({
			request,
			ir: {
				model: "poolside/laguna-s-2.1",
				messages: [],
				stream: false,
				reasoning: { enabled: false },
			},
			model: "poolside/laguna-s-2.1",
		});
		expect(request.chat_template_kwargs).toEqual({ enable_thinking: false });
	});

	it("extracts Poolside reasoning_content from completed responses", () => {
		expect(poolsideQuirks.extractReasoning?.({
			choice: { message: { reasoning_content: "private reasoning" } },
			rawContent: "answer",
		})).toEqual({ main: "answer", reasoning: ["private reasoning"] });
	});
});
