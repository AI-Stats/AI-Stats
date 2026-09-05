import { describe, expect, it } from "vitest";
import { __testUtils } from "./parse";

describe("Cohere Parse", () => {
	it("maps billed pages and token meters", () => {
		expect(__testUtils.extractUsage({
			meta: { billed_units: { pages: 2, input_tokens: 10, image_tokens: 20, output_tokens: 30 } },
		})).toEqual({ requests: 1, input_pages: 2, input_tokens: 10, image_tokens: 20, output_tokens: 30 });
	});

	it("uses the native v2 endpoint", () => {
		expect(__testUtils.COHERE_PARSE_URL).toBe("https://api.cohere.com/v2/parse");
	});
});
