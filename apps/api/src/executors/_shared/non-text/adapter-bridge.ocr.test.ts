import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encodeNonTextResponse } from "@pipeline/surfaces/non-text";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { execute } from "./adapter-bridge";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

describe("Mistral OCR non-text bridge", () => {
	it("preserves document inputs, pages, annotations, blocks, and page usage", async () => {
		let capturedBody: Record<string, any> | undefined;
		const pages = [{
			index: 0,
			markdown: "hello",
			images: [],
			dimensions: { dpi: 200, height: 100, width: 100 },
			blocks: [{ type: "text", content: "hello", top_left_x: 0, top_left_y: 0, bottom_right_x: 50, bottom_right_y: 10 }],
		}];
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/ocr"),
			onRequest: (call) => { capturedBody = call.bodyJson; },
			response: jsonResponse({
				pages,
				model: "mistral-ocr-4-0",
				document_annotation: "{\"kind\":\"note\"}",
				usage_info: { pages_processed: 1, doc_size_bytes: 100 },
			}),
		}]);

		const result = await execute({
			ir: {
				model: "mistral/ocr-4",
				document: { type: "file", file_id: "123e4567-e89b-12d3-a456-426614174000" },
				pages: [0],
				includeBlocks: true,
			},
			requestId: "req_ocr_1",
			workspaceId: "team_test",
			providerId: "mistral",
			endpoint: "ocr",
			providerModelSlug: "mistral-ocr-4-0",
			byokMeta: [],
			pricingCard: null,
			meta: {},
		} as any);
		mock.restore();

		expect(capturedBody).toMatchObject({
			model: "mistral-ocr-4-0",
			document: { type: "file", file_id: "123e4567-e89b-12d3-a456-426614174000" },
			pages: [0],
			include_blocks: true,
		});
		expect(result.kind).toBe("completed");
		if (result.kind !== "completed" || !result.ir) throw new Error("Expected completed OCR IR");
		expect(result.ir).toMatchObject({
			model: "mistral-ocr-4-0",
			text: "hello",
			pages,
			documentAnnotation: "{\"kind\":\"note\"}",
		});
		const publicResponse = encodeNonTextResponse("ocr", result.ir as any, "req_ocr_1");
		expect(publicResponse).toMatchObject({
			object: "ocr",
			text: "hello",
			pages,
			document_annotation: "{\"kind\":\"note\"}",
			usage: { input_pages: 1, doc_size_bytes: 100 },
		});
	});
});
