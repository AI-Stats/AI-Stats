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
});
