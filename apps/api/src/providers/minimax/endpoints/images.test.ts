import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";

vi.mock("../../openai-compatible/config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../openai-compatible/config")>();
	return {
		...actual,
		resolveOpenAICompatKey: vi.fn(async () => ({ key: "test-minimax-key", source: "gateway", byokId: null })),
	};
});

import { exec } from "./images";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());
afterEach(() => vi.restoreAllMocks());

function args(endpoint: "images.generations" | "images.edits", body: Record<string, unknown>, providerId = "minimax") {
	return {
		endpoint,
		model: "minimax/image-01",
		providerModelSlug: "image-01",
		body: { model: "minimax/image-01", prompt: "A portrait", ...body },
		meta: { requestId: "req_minimax_image", apiKeyId: "key", apiKeyRef: "kid", apiKeyKid: "kid" },
		workspaceId: "team_test",
		providerId,
		byokMeta: [],
		pricingCard: null,
		stream: false,
	} as any;
}

describe("MiniMax image generation", () => {
	it("uses the native JSON endpoint", async () => {
		let requestBody: any;
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/image_generation"),
			response: jsonResponse({
				id: "trace-1",
				data: { image_base64: ["abc"] },
				metadata: { success_count: 1, failed_count: 0 },
				base_resp: { status_code: 0, status_msg: "success" },
			}),
			onRequest: (call) => { requestBody = call.bodyJson; },
		}]);

		const result = await exec(args("images.generations", {
			size: "1024x1024", response_format: "b64_json", n: 2,
			seed: 42, prompt_optimizer: true,
		}));
		mock.restore();

		expect(requestBody).toEqual({
			model: "image-01", prompt: "A portrait", width: 1024, height: 1024,
			response_format: "base64", n: 2, seed: 42, prompt_optimizer: true,
		});
		expect(result.normalized).toMatchObject({
			id: "trace-1", data: [{ b64_json: "abc" }], usage: { requests: 1, output_image: 1 },
		});
	});
});

describe("MiniMax image editing", () => {
	it("maps public edit images to subject_reference on the same endpoint", async () => {
		let requestBody: any;
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/image_generation"),
			response: jsonResponse({
				id: "trace-edit", data: { image_urls: ["https://example.com/result.jpg"] },
				metadata: { success_count: 1, failed_count: 0 }, base_resp: { status_code: 0, status_msg: "success" },
			}),
			onRequest: (call) => { requestBody = call.bodyJson; },
		}]);

		const result = await exec(args("images.edits", {
			image: ["https://example.com/person.jpg", "data:image/png;base64,abc"],
			aspect_ratio: "16:9",
		}));
		mock.restore();

		expect(requestBody).toMatchObject({
			model: "image-01", aspect_ratio: "16:9",
			subject_reference: [
				{ type: "character", image_file: "https://example.com/person.jpg" },
				{ type: "character", image_file: "data:image/png;base64,abc" },
			],
		});
		expect(result.normalized.data).toEqual([{ url: "https://example.com/result.jpg" }]);
	});

	it("turns MiniMax's HTTP-200 error envelope into an HTTP failure", async () => {
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/image_generation"),
			response: jsonResponse({ base_resp: { status_code: 1026, status_msg: "sensitive prompt" } }),
		}]);
		const result = await exec(args("images.edits", { image: "https://example.com/person.jpg" }));
		mock.restore();

		expect(result.upstream.status).toBe(400);
		expect(result.normalized).toEqual({ error: { type: "minimax_1026", message: "sensitive prompt" } });
	});

	it("rejects masks because MiniMax only supports subject-reference editing", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const result = await exec(args("images.edits", {
			image: "https://example.com/person.jpg",
			mask: "data:image/png;base64,mask",
		}));
		expect(result.upstream.status).toBe(400);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
