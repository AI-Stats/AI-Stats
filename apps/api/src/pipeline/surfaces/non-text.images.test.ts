import { describe, expect, it } from "vitest";
import { encodeNonTextResponse } from "./non-text";

describe("non-text image response encoding", () => {
	it("preserves the complete OpenAI image generation response contract", () => {
		const encoded = encodeNonTextResponse(
			"images.generations",
			{
				created: 1700000000,
				model: "gpt-image-2",
				provider: "openai",
				background: "transparent",
				outputFormat: "webp",
				size: "1536x1024",
				quality: "high",
				data: [{ b64Json: "encoded-image", revisedPrompt: null }],
				usage: {
					inputTokens: 12,
					outputTokens: 6208,
					totalTokens: 6220,
					input_tokens_details: { text_tokens: 10, image_tokens: 2 },
					output_tokens_details: { image_tokens: 6208 },
				} as any,
			},
			"req_image_contract",
		);

		expect(encoded).toEqual({
			created: 1700000000,
			model: "gpt-image-2",
			background: "transparent",
			output_format: "webp",
			size: "1536x1024",
			quality: "high",
			data: [{ b64_json: "encoded-image" }],
			usage: {
				input_tokens: 12,
				output_tokens: 6208,
				total_tokens: 6220,
				input_tokens_details: { text_tokens: 10, image_tokens: 2 },
				output_tokens_details: { image_tokens: 6208 },
			},
		});
	});
});
