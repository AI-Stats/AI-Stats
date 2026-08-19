import { describe, expect, it } from "vitest";
import { ModerationsSchema } from "../schemas";

describe("ModerationsSchema", () => {
	it("defaults omitted models to the canonical OpenAI moderation model", () => {
		const parsed = ModerationsSchema.parse({ input: "content to classify" });

		expect(parsed.model).toBe("openai/omni-moderation");
	});

	it("accepts OpenAI multimodal moderation inputs", () => {
		const parsed = ModerationsSchema.parse({
			input: [
				{ type: "text", text: "content to classify" },
				{
					type: "image_url",
					image_url: { url: "data:image/webp;base64,UklGRg==" },
				},
			],
		});

		expect(parsed.input).toHaveLength(2);
	});

	it("accepts Mistral chat moderation inputs and metadata", () => {
		const parsed = ModerationsSchema.parse({
			model: "mistral/mistral-moderation-2",
			input: [
				{ role: "system", content: "Classify the conversation." },
				{ role: "user", content: "content to classify" },
			],
			metadata: { tenant: "audit", attempt: 1 },
		});

		expect(parsed.input).toHaveLength(2);
		expect(parsed.metadata).toEqual({ tenant: "audit", attempt: 1 });
	});
});
