import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IRMusicGenerateRequest, IRMusicGenerateResponse } from "@core/ir";

const saveMusicJobMetaMock = vi.fn(async () => undefined);

vi.mock("@core/music-jobs", () => ({
	saveMusicJobMeta: (...args: unknown[]) => saveMusicJobMetaMock(...args),
}));

import { __nonTextTestUtils, encodeNonTextResponse } from "./non-text";

describe("unified music response lifecycle", () => {
	beforeEach(() => {
		saveMusicJobMetaMock.mockClear();
	});

	it("returns a Phaseo request ID while preserving the provider-native ID", () => {
		const encoded = encodeNonTextResponse("music.generate", {
			id: "req_phaseo_music_1",
			nativeId: "provider_music_1",
			model: "music-model",
			provider: "gmicloud",
			status: "completed",
			audioUrl: "https://media.example/music.mp3",
		} as IRMusicGenerateResponse, "req_phaseo_music_1");

		expect(encoded.id).toBe("req_phaseo_music_1");
		expect(encoded.nativeResponseId).toBe("provider_music_1");
		expect(encoded.audio_url).toBe("https://media.example/music.mp3");
	});

	it("persists a provider-independent retrieval snapshot under the Phaseo ID", async () => {
		const request: IRMusicGenerateRequest = {
			model: "minimax/music-3.0:free",
			prompt: "Ambient instrumental",
			format: "mp3",
		};
		const response: IRMusicGenerateResponse = {
			id: "req_phaseo_music_2",
			nativeId: "gmi_music_2",
			model: request.model,
			provider: "gmicloud",
			status: "completed",
			audioUrl: "https://media.example/music-2.mp3",
			output: [{
				index: 0,
				id: "gmi_music_2",
				audioUrl: "https://media.example/music-2.mp3",
				streamAudioUrl: "https://media.example/music-2-stream.mp3",
				title: "Ambient instrumental",
				tags: "ambient",
				duration: 25.364,
			}],
			usage: {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
				output_audio_seconds: 25.364,
			} as any,
		};

		await __nonTextTestUtils.persistMusicResponse(
			"workspace_1",
			"req_phaseo_music_2",
			request,
			response,
		);

		expect(saveMusicJobMetaMock).toHaveBeenCalledWith(
			"workspace_1",
			"req_phaseo_music_2",
			expect.objectContaining({
				provider: "gmicloud",
				nativeResponseId: "gmi_music_2",
				duration: 25.364,
				format: "mp3",
				output: [expect.objectContaining({
					audio_url: "https://media.example/music-2.mp3",
					stream_audio_url: "https://media.example/music-2-stream.mp3",
					title: "Ambient instrumental",
					tags: "ambient",
					duration: 25.364,
				})],
			}),
		);
	});

	it("deduplicates inline audio while retaining provider metadata", async () => {
		await __nonTextTestUtils.persistMusicResponse(
			"workspace_1",
			"req_phaseo_music_3",
			{ model: "elevenlabs/music", format: "mp3" },
			{
				id: "req_phaseo_music_3",
				nativeId: "song_3",
				model: "music_v2",
				provider: "elevenlabs",
				status: "completed",
				audioBase64: "AQIDBA==",
				result: { audio_base64: "AQIDBA==", metadata: { seed: 7 } },
				rawResponse: { data: { audio: "AQIDBA==", status: 2 }, trace_id: "trace_3" },
			},
		);

		expect(saveMusicJobMetaMock).toHaveBeenCalledWith(
			"workspace_1",
			"req_phaseo_music_3",
			expect.objectContaining({
				audioBase64: "AQIDBA==",
				output: null,
				result: { metadata: { seed: 7 } },
				rawResponse: { data: { status: 2 }, trace_id: "trace_3" },
			}),
		);
	});
});
