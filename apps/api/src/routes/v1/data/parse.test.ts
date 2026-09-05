import { describe, expect, it } from "vitest";
import { ParseSchema } from "@core/schemas";

describe("Parse request schema", () => {
	it("accepts image URLs and defaults to Markdown", () => {
		const value = ParseSchema.parse({
			model: "cohere/parse-v5.0",
			document: { type: "image_url", image_url: "https://example.com/page.png" },
		});
		expect(value.output_format).toBe("markdown");
	});

	it("rejects file and PDF URL document types", () => {
		expect(() => ParseSchema.parse({
			model: "cohere/parse-v5.0",
			document: { type: "document_url", document_url: "https://example.com/file.pdf" },
		})).toThrow();
	});
});
