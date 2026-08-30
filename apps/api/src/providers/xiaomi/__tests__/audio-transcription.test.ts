import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { exec } from "../endpoints/audio-transcription";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

describe("Xiaomi audio.transcription endpoint", () => {
	it("maps a WAV upload into Xiaomi chat audio input and normalizes the transcript", async () => {
		let capturedBody: any;
		let capturedHeaders: Record<string, string> = {};
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/chat/completions"),
			response: jsonResponse({
				id: "chatcmpl_asr_1",
				choices: [{
					message: { role: "assistant", content: "Recognized text" },
					finish_reason: "stop",
				}],
				usage: { prompt_tokens: 8, completion_tokens: 2, total_tokens: 10 },
			}),
			onRequest: (call) => {
				capturedBody = call.bodyJson;
				capturedHeaders = call.headers;
			},
		}]);

		const result = await exec({
			endpoint: "audio.transcription",
			model: "xiaomi/mimo-v2.5-asr",
			body: {
				model: "xiaomi/mimo-v2.5-asr",
				file: new File([new Uint8Array([1, 2, 3, 4])], "sample.wav", { type: "audio/wav" }),
				language: "en",
			},
			meta: {
				requestId: "req_xiaomi_asr",
				apiKeyId: "key_test",
				testId: "aimock-xiaomi-transcription",
			},
			workspaceId: "team_test",
			providerId: "xiaomi",
			byokMeta: [],
			pricingCard: null,
			providerModelSlug: "mimo-v2.5-asr",
			stream: false,
		} as any);
		mock.restore();

		expect(result.upstream.status).toBe(200);
		expect(capturedHeaders["X-Test-Id"]).toBe("aimock-xiaomi-transcription");
		expect(capturedBody).toEqual({
			model: "mimo-v2.5-asr",
			messages: [{
				role: "user",
				content: [{
					type: "input_audio",
					input_audio: { data: "data:audio/wav;base64,AQIDBA==" },
				}],
			}],
			asr_options: { language: "en" },
		});
		expect(result.normalized?.text).toBe("Recognized text");
		expect((result.bill.usage as any)?.requests).toBe(1);
	});

	it("rejects unsupported audio formats before calling Xiaomi", async () => {
		const result = await exec({
			endpoint: "audio.transcription",
			body: {
				model: "xiaomi/mimo-v2.5-asr",
				file: new File([new Uint8Array([1])], "sample.flac", { type: "audio/flac" }),
			},
			meta: {},
			workspaceId: "team_test",
			providerId: "xiaomi",
			byokMeta: [],
			pricingCard: null,
			providerModelSlug: "mimo-v2.5-asr",
			stream: false,
		} as any);

		expect(result.upstream.status).toBe(400);
		expect(await result.upstream.json()).toMatchObject({ error: { param: "file" } });
	});
});
