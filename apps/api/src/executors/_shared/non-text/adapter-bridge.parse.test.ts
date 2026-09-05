import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encodeNonTextResponse } from "@pipeline/surfaces/non-text";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { execute } from "./adapter-bridge";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

describe("Cohere Parse non-text bridge", () => {
	it("preserves structured pages and maps billed pages", async () => {
		let capturedBody: Record<string, any> | undefined;
		const pages = [{
			type: "blocks",
			index: 0,
			blocks: [{ type: "text", text: { content: "Invoice" } }],
		}];
		const mock = installFetchMock([{
			match: (url) => url === "https://api.cohere.com/v2/parse",
			onRequest: (call) => { capturedBody = call.bodyJson; },
			response: jsonResponse({ id: "parse_123", pages, meta: { billed_units: { pages: 1 } } }),
		}]);

		const result = await execute({
			ir: {
				model: "cohere/parse-v5.0",
				document: { type: "image_url", imageUrl: "https://example.com/invoice.png" },
				outputFormat: "blocks",
			},
			requestId: "req_parse_1",
			workspaceId: "team_test",
			providerId: "cohere",
			endpoint: "parse",
			providerModelSlug: "parse-v5.0",
			byokMeta: [],
			pricingCard: null,
			meta: {},
		} as any);
		mock.restore();

		expect(capturedBody).toEqual({
			model: "parse-v5.0",
			document: { type: "image_url", image_url: "https://example.com/invoice.png" },
			output_format: "blocks",
		});
		expect(result.kind).toBe("completed");
		if (result.kind !== "completed" || !result.ir) throw new Error("Expected completed Parse IR");
		const response = encodeNonTextResponse("parse", result.ir as any, "req_parse_1");
		expect(response).toMatchObject({
			id: "parse_123",
			object: "parse",
			model: "parse-v5.0",
			provider: "cohere",
			pages,
			meta: { billed_units: { pages: 1 } },
			usage: { input_pages: 1 },
		});
	});
});
