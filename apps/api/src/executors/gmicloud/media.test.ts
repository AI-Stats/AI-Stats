import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { IRAudioSpeechRequest, IRMusicGenerateRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { setupTestRuntime, teardownTestRuntime } from "../../../tests/helpers/runtime";
import { installFetchMock, jsonResponse } from "../../../tests/helpers/mock-fetch";
import { execute as executeMusic } from "./music-generate";
import { execute as executeSpeech } from "./audio-speech";

function args(ir: any, endpoint: "audio.speech" | "music.generate", slug: string): ExecutorExecuteArgs {
	return {
		ir,
		requestId: "req_gmicloud_media_test",
		workspaceId: "team_test",
		providerId: "gmicloud",
		endpoint,
		protocol: "gmicloud.native",
		capability: endpoint,
		providerModelSlug: slug,
		capabilityParams: null,
		byokMeta: [],
		pricingCard: null,
		meta: {},
	} as ExecutorExecuteArgs;
}

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

describe("GMICloud native media executors", () => {
	it("submits Music 3.0 through the request queue and returns music IR", async () => {
		let body: any;
		const mock = installFetchMock([{
			match: (url, init) => url.endsWith("/api/v1/ie/requestqueue/apikey/requests") && init?.method === "POST",
			response: jsonResponse({ request_id: "music_req_1", status: "success", outcome: { media_urls: [{ url: "https://gmi.example/music.mp3" }] } }),
			onRequest: (call) => { body = call.bodyJson; },
		}]);

		const result = await executeMusic(args({ model: "minimax/music-3.0:free", prompt: "cinematic ambient" } as IRMusicGenerateRequest, "music.generate", "minimax-music-3.0"));
		mock.restore();

		expect(body).toEqual({ model: "minimax-music-3.0", payload: { prompt: "cinematic ambient", lyrics: "[Instrumental]" } });
		expect((result.ir as any)?.nativeId).toBe("music_req_1");
		expect((result.ir as any)?.audioUrl).toBe("https://gmi.example/music.mp3");
	});

	it("normalizes documented millisecond duration into seconds", async () => {
		const mock = installFetchMock([{
			match: (url, init) => url.endsWith("/api/v1/ie/requestqueue/apikey/requests") && init?.method === "POST",
			response: jsonResponse({ request_id: "music_req_duration", status: "success", outcome: { audio_url: "https://gmi.example/music.mp3", duration_ms: 25364 } }),
		}]);

		const result = await executeMusic(args({ model: "minimax/music-3.0:free", prompt: "cinematic ambient" } as IRMusicGenerateRequest, "music.generate", "minimax-music-3.0"));
		mock.restore();

		expect((result.ir as any)?.usage?.output_audio_seconds).toBe(25.364);
	});

	it("maps the public music format into MiniMax audio_setting", async () => {
		let body: any;
		const mock = installFetchMock([{
			match: (url, init) => url.endsWith("/api/v1/ie/requestqueue/apikey/requests") && init?.method === "POST",
			response: jsonResponse({ request_id: "music_req_format", status: "success", outcome: { media_urls: [{ url: "https://gmi.example/music.mp3" }] } }),
			onRequest: (call) => { body = call.bodyJson; },
		}]);

		await executeMusic(args({ model: "minimax/music-3.0:free", prompt: "ambient", format: "mp3", vendor: { minimax: { audio_setting: { bitrate: 256000 } } } } as IRMusicGenerateRequest, "music.generate", "minimax-music-3.0"));
		mock.restore();

		expect(body).toEqual({ model: "minimax-music-3.0", payload: { prompt: "ambient", lyrics: "[Instrumental]", audio_setting: { sample_rate: 44100, bitrate: 256000, format: "mp3" } } });
	});

	it("rejects explicit non-instrumental music without lyrics", async () => {
		const result = await executeMusic(args({ model: "minimax/music-3.0:free", prompt: "vocals", rawRequest: { is_instrumental: false } } as IRMusicGenerateRequest, "music.generate", "minimax-music-3.0"));

		expect(result.upstream.status).toBe(400);
	});

	it("polls Speech 2.8 and inlines the returned audio into speech IR", async () => {
		const mock = installFetchMock([
			{
				match: (url, init) => url.endsWith("/api/v1/ie/requestqueue/apikey/requests") && init?.method === "POST",
				response: jsonResponse({ request_id: "speech_req_1", status: "success", outcome: { media_urls: [{ url: "https://gmi.example/speech.mp3" }] } }),
			},
			{
				match: (url) => url === "https://gmi.example/speech.mp3",
				response: new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "audio/mpeg" } }),
			},
		]);

		const result = await executeSpeech(args({ model: "minimax/speech-2.8:free", input: "Hello from GMI Cloud", voice: "English_expressive_narrator" } as IRAudioSpeechRequest, "audio.speech", "minimax-tts-speech-2.8-hd"));
		mock.restore();

		expect((result.ir as any)?.nativeId).toBe("speech_req_1");
		expect((result.ir as any)?.audio?.data).toBe("AQID");
		expect((result.ir as any)?.audio?.mimeType).toBe("audio/mpeg");
	});

	it("does not allow GMI Cloud extensions to replace canonical speech fields", async () => {
		let body: any;
		const mock = installFetchMock([{
			match: (url, init) => url.endsWith("/api/v1/ie/requestqueue/apikey/requests") && init?.method === "POST",
			response: jsonResponse({ request_id: "speech_req_safe", status: "success", outcome: { audio_base64: "AQ==" } }),
			onRequest: (call) => { body = call.bodyJson; },
		}]);

		await executeSpeech(args({
			model: "minimax/speech-2.8:free",
			input: "validated text",
			voice: "validated-voice",
			speed: 1.25,
			rawRequest: { gmicloud: { text: "attacker text", voice_id: "attacker-voice", format: "wav", speed: "fast" } },
		} as IRAudioSpeechRequest, "audio.speech", "minimax-tts-speech-2.8-hd"));
		mock.restore();

		expect(body.payload).toMatchObject({ text: "validated text", voice_id: "validated-voice", format: "mp3", speed: "1.25" });
	});

	it("returns a non-OK result for terminal queue failures", async () => {
		let pollCount = 0;
		const mock = installFetchMock([
			{ match: (url, init) => url.endsWith("/api/v1/ie/requestqueue/apikey/requests") && init?.method === "POST", response: jsonResponse({ request_id: "failed_req", status: "queued" }) },
			{ match: (url) => url.endsWith("/failed_req"), response: () => { pollCount += 1; return jsonResponse({ status: "failed", error: "provider rejected request" }); } },
		]);

		const result = await executeMusic(args({ model: "minimax/music-3.0:free", prompt: "ambient" } as IRMusicGenerateRequest, "music.generate", "minimax-music-3.0"));
		mock.restore();

		expect(pollCount).toBe(1);
		expect(result.upstream.status).toBe(502);
	});

	it("preserves non-OK poll responses", async () => {
		const mock = installFetchMock([
			{ match: (url, init) => url.endsWith("/api/v1/ie/requestqueue/apikey/requests") && init?.method === "POST", response: jsonResponse({ request_id: "error_req", status: "queued" }) },
			{ match: (url) => url.endsWith("/error_req"), response: jsonResponse({ error: "upstream unavailable" }, { status: 503 }) },
		]);

		const result = await executeMusic(args({ model: "minimax/music-3.0:free", prompt: "ambient" } as IRMusicGenerateRequest, "music.generate", "minimax-music-3.0"));
		mock.restore();

		expect(result.upstream.status).toBe(503);
	});
});
