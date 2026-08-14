import { describe, expect, it } from "vitest";
import { perplexityQuirks } from "../../providers/perplexity/quirks";

describe("Perplexity Sonar quirks", () => {
	it("rewrites developer role and maps reasoning effort", () => {
		const request: Record<string, any> = {
			model: "sonar-reasoning-pro",
			messages: [
				{ role: "developer", content: "Be concise." },
				{ role: "user", content: "hello" },
			],
		};

		perplexityQuirks.transformRequest?.({
			request,
			ir: { reasoning: { effort: "xhigh" } } as any,
		});

		expect(request.messages[0].role).toBe("system");
		expect(request.reasoning_effort).toBe("high");
	});

	it("defaults reasoning_effort when reasoning is enabled", () => {
		const request: Record<string, any> = {
			model: "sonar-reasoning-pro",
			messages: [{ role: "user", content: "hello" }],
		};

		perplexityQuirks.transformRequest?.({
			request,
			ir: { reasoning: { enabled: true } } as any,
		});

		expect(request.reasoning_effort).toBe("medium");
	});

	it("maps xlow effort to minimal", () => {
		const request: Record<string, any> = {
			model: "sonar-reasoning-pro",
			messages: [{ role: "user", content: "hello" }],
		};

		perplexityQuirks.transformRequest?.({
			request,
			ir: { reasoning: { effort: "xlow" } } as any,
		});

		expect(request.reasoning_effort).toBe("minimal");
	});

	it("extracts reasoning_content to IR reasoning", () => {
		const extracted = perplexityQuirks.extractReasoning?.({
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

	it("maps roles, reasoning, and nested public search controls to Sonar's wire shape", () => {
		const request: Record<string, any> = {
			messages: [{ role: "developer", content: "ground every answer" }],
			web_search_options: {
				search_context_size: "high",
				user_location: { country: "GB" },
				search_mode: "academic",
				search_domain_filter: ["nature.com"],
				return_images: true,
			},
		};

		perplexityQuirks.transformRequest?.({
			request,
			ir: { reasoning: { effort: "xhigh" } } as any,
		});

		expect(request.messages).toEqual([{ role: "system", content: "ground every answer" }]);
		expect(request.reasoning_effort).toBe("high");
		expect(request.search_mode).toBe("academic");
		expect(request.search_domain_filter).toEqual(["nature.com"]);
		expect(request.return_images).toBe(true);
		expect(request.web_search_options).toEqual({
			search_context_size: "high",
			user_location: { country: "GB" },
		});
	});

	it("rejects undocumented multimodal Sonar message input", () => {
		const request: Record<string, any> = {
			messages: [{
				role: "user",
				content: [{ type: "image_url", image_url: { url: "https://example.com/image.png" } }],
			}],
		};
		expect(() => perplexityQuirks.transformRequest?.({ request, ir: {} as any })).toThrow(
			"perplexity_sonar_multimodal_input_unsupported",
		);
	});
});
