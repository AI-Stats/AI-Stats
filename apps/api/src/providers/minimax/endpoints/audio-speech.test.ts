import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";

vi.mock("../../openai-compatible/config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../openai-compatible/config")>();
	return { ...actual, resolveOpenAICompatKey: vi.fn(async () => ({ key: "test-minimax-key", source: "gateway", byokId: null })) };
});

import { exec } from "./audio-speech";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());
afterEach(() => vi.restoreAllMocks());

function args(body: Record<string, unknown>) {
	return {
		endpoint: "audio.speech", model: "minimax/speech-2.8-hd", providerModelSlug: "speech-2.8-hd",
		body: { model: "minimax/speech-2.8-hd", input: "Hello", voice: "English_Graceful_Lady", ...body },
		meta: { requestId: "req_minimax_speech", apiKeyId: "key", apiKeyRef: "kid", apiKeyKid: "kid" },
		workspaceId: "team", providerId: "minimax", byokMeta: [], pricingCard: null, stream: false,
	} as any;
}

describe("MiniMax audio.speech", () => {
	it("does not allow provider config to override validated request fields", async () => {
		let requestBody: any;
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/t2a_v2"),
			response: jsonResponse({ data: { audio: "00", status: 2 }, base_resp: { status_code: 0 } }),
			onRequest: (call) => { requestBody = call.bodyJson; },
		}]);
		await exec(args({
			config: { minimax: { model: "speech-2.8-turbo", text: "unvalidated override", stream: true } },
		}));
		mock.restore();
		expect(requestBody).toMatchObject({
			model: "speech-2.8-hd",
			text: "Hello",
			stream: false,
		});
	});

	it("maps the public request to t2a_v2 and decodes hex audio", async () => {
		let requestBody: any;
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/t2a_v2"),
			response: jsonResponse({
				data: { audio: "4869", status: 2 }, trace_id: "trace-1",
				extra_info: { usage_characters: 5, audio_format: "mp3" },
				base_resp: { status_code: 0, status_msg: "success" },
			}),
			onRequest: (call) => { requestBody = call.bodyJson; },
		}]);
		const result = await exec(args({
			speed: 1.25, response_format: "mp3",
			config: { minimax: { language_boost: "English", voice_setting: { vol: 2 } } },
		}));
		mock.restore();

		expect(requestBody).toMatchObject({
			model: "speech-2.8-hd", text: "Hello", stream: false, output_format: "hex",
			voice_setting: { voice_id: "English_Graceful_Lady", speed: 1.25, vol: 2 },
			audio_setting: { format: "mp3" }, language_boost: "English",
		});
		expect(new TextDecoder().decode(await new Response(result.stream).arrayBuffer())).toBe("Hi");
		expect((await result.usageFinalizer?.())?.usage).toEqual({ requests: 1, input_characters: 5 });
	});

	it("maps MiniMax SSE hex chunks to public base64 speech events", async () => {
		const native = [
			`data: ${JSON.stringify({ data: { audio: "4869", status: 1 }, base_resp: { status_code: 0 } })}\n\n`,
			`data: ${JSON.stringify({ data: { audio: "21", status: 2 }, extra_info: { usage_characters: 5 }, base_resp: { status_code: 0 } })}\n\n`,
		].join("");
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/t2a_v2"),
			response: new Response(native, { headers: { "content-type": "text/event-stream" } }),
		}]);
		const result = await exec(args({ stream_format: "sse" }));
		const output = await new Response(result.stream).text();
		mock.restore();

		expect(output).toContain('"type":"speech.audio.delta","audio":"SGk="');
		expect(output).toContain('"type":"speech.audio.delta","audio":"IQ=="');
		expect(output).toContain('"type":"speech.audio.done"');
		expect((await result.usageFinalizer?.())?.usage.input_characters).toBe(5);
	});

	it("supports cloned/mixed voices through MiniMax extensions", async () => {
		let requestBody: any;
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/t2a_v2"),
			response: jsonResponse({ data: { audio: "00", status: 2 }, extra_info: { usage_characters: 5 }, base_resp: { status_code: 0 } }),
			onRequest: (call) => { requestBody = call.bodyJson; },
		}]);
		await exec(args({ voice: undefined, config: { minimax: { timbre_weights: [{ voice_id: "cloned-voice", weight: 100 }] } } }));
		mock.restore();
		expect(requestBody.timbre_weights).toEqual([{ voice_id: "cloned-voice", weight: 100 }]);
		expect(requestBody).not.toHaveProperty("voice_setting");
	});

	it("preserves MiniMax's optional 24-hour URL output", async () => {
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/t2a_v2"),
			response: jsonResponse({ data: { audio: "https://example.com/audio.mp3", status: 2 }, trace_id: "trace-url", extra_info: { usage_characters: 5 }, base_resp: { status_code: 0 } }),
		}]);
		const result = await exec(args({ config: { minimax: { output_format: "url" } } }));
		mock.restore();
		expect(result.normalized).toMatchObject({ id: "trace-url", audio_url: "https://example.com/audio.mp3", usage: { input_characters: 5 } });
	});

	it("converts MiniMax's success-status error envelope to HTTP failure", async () => {
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/t2a_v2"),
			response: jsonResponse({ base_resp: { status_code: 1039, status_msg: "TPM exceeded" } }),
		}]);
		const result = await exec(args({}));
		mock.restore();
		expect(result.upstream.status).toBe(429);
		expect(result.normalized).toEqual({ error: { type: "minimax_1039", message: "TPM exceeded" } });
	});
});
