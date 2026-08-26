import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { IRAudioSpeechRequest, IRMusicGenerateRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { setupTestRuntime, teardownTestRuntime } from "../../../tests/helpers/runtime";
import { installFetchMock, jsonResponse } from "../../../tests/helpers/mock-fetch";
import { execute as executeMusic } from "./music-generate";
import { execute as executeSpeech } from "./audio-speech";

const saveMusicJobMetaMock = vi.fn(async () => undefined);

vi.mock("@core/music-jobs", () => ({
	saveMusicJobMeta: (...args: unknown[]) => saveMusicJobMetaMock(...args),
}));

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
	beforeEach(() => saveMusicJobMetaMock.mockClear());

	it("submits Music 3.0 through the request queue and returns music IR", async () => {
		let body: any;
		const mock = installFetchMock([{
			match: (url, init) => url.endsWith("/api/v1/ie/requestqueue/apikey/requests") && init?.method === "POST",
			response: jsonResponse({ request_id: "music_req_1", status: "success", outcome: { media_urls: [{ url: "https://gmi.example/music.mp3" }] } }),
			onRequest: (call) => { body = call.bodyJson; },
		}]);

		const result = await executeMusic(args({ model: "minimax/music-3.0:free", prompt: "cinematic ambient" } as IRMusicGenerateRequest, "music.generate", "minimax-music-3.0"));
		mock.restore();

		expect(body).toEqual({ model: "minimax-music-3.0", payload: { prompt: "cinematic ambient" } });
		expect((result.ir as any)?.nativeId).toBe("music_req_1");
		expect((result.ir as any)?.audioUrl).toBe("https://gmi.example/music.mp3");
		expect(saveMusicJobMetaMock).toHaveBeenCalledWith("team_test", "music_req_1", expect.objectContaining({
		provider: "gmicloud",
		status: "completed",
		nativeResponseId: "music_req_1",
		output: [expect.objectContaining({ audio_url: "https://gmi.example/music.mp3" })],
	}));
	});

	it("maps the public music format into MiniMax audio_setting", async () => {
		let body: any;
		const mock = installFetchMock([{
			match: (url, init) => url.endsWith("/api/v1/ie/requestqueue/apikey/requests") && init?.method === "POST",
			response: jsonResponse({ request_id: "music_req_format", status: "success", outcome: { media_urls: [{ url: "https://gmi.example/music.mp3" }] } }),
			onRequest: (call) => { body = call.bodyJson; },
		}]);

		await executeMusic(args({ model: "minimax/music-3.0:free", prompt: "ambient", format: "mp3" } as IRMusicGenerateRequest, "music.generate", "minimax-music-3.0"));
		mock.restore();

		expect(body).toEqual({ model: "minimax-music-3.0", payload: { prompt: "ambient", audio_setting: { format: "mp3" } } });
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
