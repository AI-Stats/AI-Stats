import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { IRMusicGenerateRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { execute } from "./index";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";

const saveMusicJobMetaMock = vi.fn(async () => undefined);

vi.mock("@core/music-jobs", () => ({
	saveMusicJobMeta: (...args: unknown[]) => saveMusicJobMetaMock(...args),
}));

function buildArgs(
	ir: IRMusicGenerateRequest,
	providerModelSlug: string | null = "music-2.6-free",
): ExecutorExecuteArgs {
	return {
		ir,
		requestId: "req_minimax_music_test",
		workspaceId: "team_test",
		providerId: "minimax",
		endpoint: "music.generate",
		protocol: "minimax.music",
		capability: "music.generate",
		providerModelSlug,
		capabilityParams: null,
		byokMeta: [],
		pricingCard: null,
		meta: {},
	} as ExecutorExecuteArgs;
}

beforeAll(() => {
	setupTestRuntime();
});

afterAll(() => {
	teardownTestRuntime();
});

describe("minimax music executor", () => {
	it("defaults prompt-only requests to instrumental mode instead of copying prompt into lyrics", async () => {
		let capturedBody: Record<string, unknown> | null = null;
		const mock = installFetchMock([
			{
				match: (url) => url.endsWith("/v1/music_generation"),
				response: jsonResponse({
					task_id: "music_task_123",
					data: {
						status: 2,
						audio: "https://mini.example/generated.mp3",
					},
					base_resp: { status_code: 0, status_msg: "success" },
				}),
				onRequest: (call) => {
					capturedBody = call.bodyJson as Record<string, unknown>;
				},
			},
		]);

		const result = await execute(
			buildArgs({
				model: "minimax/music-2.6",
				prompt: "ambient cinematic with airy pads and subtle piano",
			}),
		);

		mock.restore();

		expect(result.kind).toBe("completed");
		expect(result.upstream?.status).toBe(200);
		expect(capturedBody?.prompt).toBe("ambient cinematic with airy pads and subtle piano");
		expect(capturedBody?.is_instrumental).toBe(true);
		expect(capturedBody?.lyrics).toBeUndefined();
	});

	it("returns validation error when non-instrumental is requested without lyrics", async () => {
		const result = await execute(
			buildArgs({
				model: "minimax/music-2.6",
				prompt: "epic orchestral pop",
				vendor: {
					minimax: {
						is_instrumental: false,
					},
				},
			}),
		);

		expect(result.kind).toBe("completed");
		expect(result.upstream?.status).toBe(400);
		const payload = await result.upstream?.json();
		expect(payload?.reason).toBe("lyrics_required_for_non_instrumental_minimax_music");
	});

	it("maps current Music 3.0 fields and normalizes the synchronous URL response", async () => {
		let capturedBody: Record<string, any> | null = null;
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/music_generation"),
			response: jsonResponse({
				data: { status: 2, audio: "https://mini.example/song.mp3" },
				trace_id: "trace_music_3",
				extra_info: { music_duration: 25364 },
				base_resp: { status_code: 0, status_msg: "success" },
			}),
			onRequest: (call) => { capturedBody = call.bodyJson as Record<string, any>; },
		}]);

		const result = await execute(buildArgs({
			model: "minimax/music-3.0",
			prompt: "Indie folk, melancholic",
			format: "mp3",
			vendor: { minimax: { lyrics_optimizer: true, output_format: "url" } },
		}, "music-3.0"));

		mock.restore();
		expect(capturedBody).toMatchObject({
			model: "music-3.0",
			lyrics_optimizer: true,
			stream: false,
			output_format: "url",
			audio_setting: { format: "mp3" },
		});
		expect((result.ir as any)?.nativeId).toBe("trace_music_3");
		expect((result.ir as any)?.status).toBe("completed");
		expect((result.ir as any)?.audioUrl).toBe("https://mini.example/song.mp3");
		expect((result.ir as any)?.usage?.output_audio_seconds).toBeCloseTo(25.364);
	});

	it("validates cover inputs and forwards exactly one reference", async () => {
		let capturedBody: Record<string, any> | null = null;
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/music_generation"),
			response: jsonResponse({ data: { status: 2, audio: "https://mini.example/cover.mp3" }, base_resp: { status_code: 0 } }),
			onRequest: (call) => { capturedBody = call.bodyJson as Record<string, any>; },
		}]);

		const result = await execute(buildArgs({
			model: "minimax/music-cover",
			prompt: "Smooth jazz lounge cover",
			vendor: { minimax: { audio_url: "https://example.com/source.mp3" } },
		}, "music-cover"));

		mock.restore();
		expect(result.upstream?.status).toBe(200);
		expect(capturedBody).toMatchObject({
			model: "music-cover",
			audio_url: "https://example.com/source.mp3",
			prompt: "Smooth jazz lounge cover",
		});
		expect(capturedBody?.is_instrumental).toBeUndefined();
	});

	it("maps HTTP-200 application failures to useful HTTP status", async () => {
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/music_generation"),
			response: jsonResponse({ base_resp: { status_code: 1008, status_msg: "insufficient balance" } }),
		}]);
		const result = await execute(buildArgs({
			model: "minimax/music-3.0",
			prompt: "Ambient piano",
		}, "music-3.0"));
		mock.restore();
		expect(result.upstream?.status).toBe(402);
	});
});
