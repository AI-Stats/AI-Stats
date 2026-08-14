import { describe, expect, it } from "vitest";
import type { IRVideoGenerationRequest } from "@core/ir";
import { buildLtxVideoRequest } from ".";

function request(overrides: Partial<IRVideoGenerationRequest> = {}): IRVideoGenerationRequest {
	return { model: "ltx-2-5-pro", prompt: "A presenter speaks naturally", ...overrides };
}

describe("LTX audio-to-video request mapping", () => {
	it("maps one audio reference and an optional first frame to the async audio endpoint", () => {
		const mapped = buildLtxVideoRequest(request({
			inputAudioDurationSeconds: 8,
			inputReferences: [
				{ type: "audio", role: "source", url: "https://example.com/speech.mp3" },
				{ type: "image", role: "first_frame", url: "https://example.com/presenter.jpg" },
			],
		}), "ltx-2-5-pro");
		expect(mapped.endpoint).toBe("audio-to-video");
		expect(mapped.seconds).toBe(8);
		expect(mapped.body).toMatchObject({ audio_uri: "https://example.com/speech.mp3", image_uri: "https://example.com/presenter.jpg", model: "ltx-2-5-pro" });
	});

	it("bills the validated source-audio duration", () => {
		const mapped = buildLtxVideoRequest(request({
			inputAudioDurationSeconds: 2,
			inputReferences: [{ type: "audio", role: "source", url: "https://example.com/twenty-seconds.mp3" }],
		}), "ltx-2-5-pro");

		expect(mapped.seconds).toBe(2);
		expect(mapped.inputAudioSeconds).toBe(2);
	});

	it("requires a declared, billable audio duration", () => {
		expect(() => buildLtxVideoRequest(request({ inputReferences: [{ type: "audio", role: "source", url: "https://example.com/speech.mp3" }] }), "ltx-2-5-pro"))
			.toThrow("input_audio_duration is required");
	});

	it("rejects audio mode on models that do not support it", () => {
		expect(() => buildLtxVideoRequest(request({ inputAudioDurationSeconds: 8, inputReferences: [{ type: "audio", role: "source", url: "https://example.com/speech.mp3" }] }), "ltx-2-3-fast"))
			.toThrow("does not support LTX audio-to-video");
	});
});
