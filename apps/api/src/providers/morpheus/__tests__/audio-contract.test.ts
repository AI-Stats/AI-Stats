import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AudioTranscriptionSchema } from "@core/schemas";
import { execute as executeNonTextAdapter } from "@executors/_shared/non-text/adapter-bridge";
import { resolveProviderExecutor } from "@executors/index";
import { installFetchMock } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";

beforeAll(() => setupRuntimeFromEnv({ MORPHEUS_API_KEY: "morpheus-audio-key" } as any));
afterAll(() => teardownTestRuntime());

function speechArgs(overrides: Record<string, unknown> = {}) {
	return {
		ir: {
			model: "hexgrad/kokoro-82m",
			input: "Hello from Morpheus",
			format: "wav",
			speed: 1.1,
			sessionId: "speech-session",
			...overrides,
		},
		requestId: "req_morpheus_speech",
		workspaceId: "team_test",
		providerId: "morpheus",
		endpoint: "audio.speech",
		providerModelSlug: "tts-kokoro",
		byokMeta: [],
		pricingCard: { rules: [] },
		meta: { returnUpstreamRequest: true },
	} as any;
}

describe("Morpheus audio capability contracts", () => {
	describe("audio.speech", () => {
		it("maps the Morpheus defaults and streams the documented binary response", async () => {
			let requestBody: any;
			const audio = new Uint8Array([82, 73, 70, 70, 1, 2, 3]);
			const mock = installFetchMock([{
				match: (url, init) => {
					requestBody = JSON.parse(String(init?.body));
					return url === "https://api.mor.org/api/v1/audio/speech";
				},
				response: new Response(audio, { headers: { "Content-Type": "audio/wav", "x-request-id": "mor-speech-1" } }),
			}]);

			const result = await executeNonTextAdapter(speechArgs());
			mock.restore();

			expect(mock.calls[0]?.headers.Authorization).toBe("Bearer morpheus-audio-key");
			expect(requestBody).toEqual({
				model: "tts-kokoro",
				input: "Hello from Morpheus",
				voice: "af_alloy",
				response_format: "wav",
				speed: 1.1,
				session_id: "speech-session",
			});
			expect(result.kind).toBe("stream");
			if (result.kind === "stream") {
				expect(result.upstream.headers.get("content-type")).toBe("audio/wav");
				expect(new Uint8Array(await new Response(result.stream).arrayBuffer())).toEqual(audio);
				expect((await result.usageFinalizer?.())?.usage).toMatchObject({ requests: 1, input_characters: 19 });
			}
		});

		it("accepts Kokoro voice names rather than applying the OpenAI voice allowlist", async () => {
			let requestBody: any;
			const mock = installFetchMock([{
				match: (_url, init) => {
					requestBody = JSON.parse(String(init?.body));
					return true;
				},
				response: new Response(new Uint8Array([1]), { headers: { "Content-Type": "audio/mpeg" } }),
			}]);
			await executeNonTextAdapter(speechArgs({ voice: "af_heart", responseFormat: "mp3", format: undefined }));
			mock.restore();
			expect(requestBody.voice).toBe("af_heart");
		});
	});

	describe("audio.transcription", () => {
		it("keeps the unverified executor disabled while accepting the native S3 contract for a future route", () => {
			expect(resolveProviderExecutor("morpheus", "audio.transcription")).toBeNull();
			const parsed = AudioTranscriptionSchema.safeParse({
				model: "morpheus/transcription",
				s3_presigned_url: "https://bucket.example/audio.wav?signature=test",
				response_format: "verbose_json",
				timestamp_granularities: ["word", "segment"],
				enable_diarization: true,
				output_content: "text",
				session_id: "transcription-session",
			});
			expect(parsed.success).toBe(true);
		});
	});
});
