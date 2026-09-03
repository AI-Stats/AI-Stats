import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { exec } from "../endpoints/images-edit";

beforeAll(setupTestRuntime);
afterAll(teardownTestRuntime);

describe("xAI image editing", () => {
	it("uses the native JSON image object rather than OpenAI multipart", async () => {
		let request: any;
		const mock = installFetchMock([{ match: (url) => url === "https://api.x.ai/v1/images/edits", response: jsonResponse({ data: [{ url: "https://imgen.x.ai/output.jpeg", mime_type: "image/jpeg" }], usage: { cost_in_usd_ticks: 200000000 } }), onRequest: (call) => { request = call.bodyJson; } }]);
		const result = await exec({ endpoint: "images.edits", model: "spacex-ai/grok-imagine-image-quality", body: { model: "spacex-ai/grok-imagine-image-quality", prompt: "Pencil sketch", image: "https://example.com/input.png", n: 1 }, meta: { requestId: "req_xai_edit", apiKeyId: "key", apiKeyRef: "kid", apiKeyKid: "kid" }, workspaceId: "team_test", providerId: "x-ai", byokMeta: [], pricingCard: null, providerModelSlug: "grok-imagine-image-quality", stream: false } as any);
		mock.restore();
		expect(request).toEqual({ model: "grok-imagine-image-quality", prompt: "Pencil sketch", image: { url: "https://example.com/input.png" }, n: 1 });
		expect(result.normalized?.data[0].url).toContain("imgen.x.ai");
	});

	it("passes Grok Imagine Image 2.0 controls and multi-image inputs", async () => {
		let request: any;
		const mock = installFetchMock([{
			match: (url) => url === "https://api.x.ai/v1/images/edits",
			response: jsonResponse({ data: [{ url: "https://imgen.x.ai/output.jpeg" }] }),
			onRequest: (call) => { request = call.bodyJson; },
		}]);
		const result = await exec({
			endpoint: "images.edits",
			model: "spacex-ai/grok-imagine-image-2.0",
			body: {
				model: "spacex-ai/grok-imagine-image-2.0",
				prompt: "Combine the references into one scene",
				image: ["https://example.com/one.png", "https://example.com/two.png"],
				aspect_ratio: "21:9",
				resolution: "2k",
				quality: "medium",
			},
			meta: { requestId: "req_xai_multi_edit", apiKeyId: "key", apiKeyRef: "kid", apiKeyKid: "kid" },
			workspaceId: "team_test",
			providerId: "x-ai",
			byokMeta: [],
			pricingCard: null,
			providerModelSlug: "grok-imagine-image-2.0",
			stream: false,
		} as any);
		mock.restore();

		expect(request).toEqual({
			model: "grok-imagine-image-2.0",
			prompt: "Combine the references into one scene",
			images: [
				{ type: "image_url", url: "https://example.com/one.png" },
				{ type: "image_url", url: "https://example.com/two.png" },
			],
			quality: "medium",
			aspect_ratio: "21:9",
			resolution: "2k",
		});
		expect(result.normalized?.data[0].url).toContain("imgen.x.ai");
	});

	it("rejects more than five Grok Imagine Image 2.0 source images", async () => {
		const result = await exec({
			endpoint: "images.edits",
			model: "spacex-ai/grok-imagine-image-2.0",
			body: {
				model: "spacex-ai/grok-imagine-image-2.0",
				prompt: "edit",
				image: ["1", "2", "3", "4", "5", "6"],
			},
			meta: { requestId: "req_xai_too_many", apiKeyId: "key", apiKeyRef: "kid", apiKeyKid: "kid" },
			workspaceId: "team_test",
			providerId: "x-ai",
			byokMeta: [],
			pricingCard: null,
			providerModelSlug: "grok-imagine-image-2.0",
			stream: false,
		} as any);

		expect(result.upstream.status).toBe(400);
	});
});
