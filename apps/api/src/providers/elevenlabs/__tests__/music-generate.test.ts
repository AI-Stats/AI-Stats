import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { installFetchMock } from "../../../../tests/helpers/mock-fetch";
import { exec } from "../endpoints/music-generate";

const REQUEST_META = {
	requestId: "req_test_music_el_1",
	apiKeyId: "key_test",
	apiKeyRef: "kid_test",
	apiKeyKid: "kid_test",
};

const PRICING_CARD = {
	provider: "elevenlabs",
	model: "test-model",
	endpoint: "music.generate",
	effective_from: null,
	effective_to: null,
	currency: "USD",
	version: null,
	rules: [
		{
			meter: "requests",
			unit: "request",
			unit_size: 1,
			price_per_unit: 1,
			currency: "USD",
			pricing_plan: "standard",
			note: null,
			match: [],
			priority: 100,
			effective_from: null,
			effective_to: null,
		},
	],
} as any;

beforeAll(() => {
	setupTestRuntime();
});

afterAll(() => {
	teardownTestRuntime();
});

describe("ElevenLabs music.generate endpoint", () => {
	it("maps request fields and normalizes binary audio", async () => {
		let capturedBody: any = null;
		const mock = installFetchMock([
			{
				match: (url) => url === "https://api.elevenlabs.example/v1/music?output_format=pcm_44100",
				response: new Response(new Uint8Array([1, 2, 3]), {
					status: 200,
					headers: { "Content-Type": "audio/pcm", "song-id": "el_job_123" },
				}),
				onRequest: (call) => {
					capturedBody = call.bodyJson;
				},
			},
		]);

		const result = await exec({
			endpoint: "music.generate",
			model: "elevenlabs/music_v1",
			body: {
				model: "elevenlabs/music_v1",
				prompt: "Ambient piano with rain",
				duration: 12,
				format: "wav",
				elevenlabs: {
					model_id: "music_v2",
					force_instrumental: true,
					custom_option: "keep-this",
				},
			},
			meta: REQUEST_META,
			workspaceId: "team_test",
			providerId: "elevenlabs",
			byokMeta: [],
			pricingCard: PRICING_CARD,
			providerModelSlug: null,
			stream: false,
		} as any);

		mock.restore();

		expect(result.upstream.status).toBe(200);
		expect(capturedBody?.model_id).toBe("music_v2");
		expect(capturedBody?.music_length_ms).toBe(12000);
		expect(capturedBody?.custom_option).toBe("keep-this");
		expect(result.normalized?.id).toBe("el_job_123");
		expect(result.normalized?.status).toBe("completed");
		expect(result.normalized?.content_type).toBe("audio/pcm");
	});

	it("handles binary responses as completed music", async () => {
		const mock = installFetchMock([
			{
				match: (url) => url === "https://api.elevenlabs.example/v1/music?output_format=mp3_44100_128",
				response: new Response(new Uint8Array([1, 2, 3, 4]), {
					status: 200,
					headers: {
						"Content-Type": "audio/mpeg",
						"song-id": "el_binary_1",
					},
				}),
			},
		]);

		const result = await exec({
			endpoint: "music.generate",
			model: "elevenlabs/music_v1",
			body: {
				model: "elevenlabs/music_v1",
				prompt: "Short upbeat melody",
				format: "mp3",
			},
			meta: REQUEST_META,
			workspaceId: "team_test",
			providerId: "elevenlabs",
			byokMeta: [],
			pricingCard: PRICING_CARD,
			providerModelSlug: null,
			stream: false,
		} as any);

		mock.restore();

		expect(result.upstream.status).toBe(200);
		expect(result.normalized?.status).toBe("completed");
		expect(typeof result.normalized?.audio_base64).toBe("string");
	});
});
