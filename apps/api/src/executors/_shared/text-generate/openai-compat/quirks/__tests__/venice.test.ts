import { describe, expect, it } from "vitest";
import { veniceQuirks } from "../../providers/venice/quirks";

describe("Venice quirks", () => {
	it("maps responses input_items to input", () => {
		const request: Record<string, any> = {
			model: "llama-3.2-3b",
			input_items: [{
				type: "message",
				role: "user",
				content: [{ type: "input_text", text: "hi" }],
			}],
		};

		veniceQuirks.transformRequest?.({
			request,
			ir: {} as any,
			model: "llama-3.2-3b",
		});

		expect(Array.isArray(request.input)).toBe(true);
		expect(request.input_items).toBeUndefined();
	});

	it("passes Venice extensions and preserves reasoning output", () => {
		const request: Record<string, any> = { model: "zai-org-glm-5-1", messages: [] };
		veniceQuirks.transformRequest?.({
			request,
			ir: { vendor: { venice: { enable_web_search: "auto", disable_thinking: false } } } as any,
		});
		expect(request.venice_parameters).toEqual({
			enable_web_search: "auto",
			disable_thinking: false,
		});
		expect(veniceQuirks.extractReasoning?.({
			choice: { message: { reasoning_content: "working" } },
			rawContent: "answer",
		})).toEqual({ main: "answer", reasoning: ["working"] });
	});
});
