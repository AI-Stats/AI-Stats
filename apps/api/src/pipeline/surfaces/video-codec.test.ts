import { describe, expect, it } from "vitest";
import {
	decodeOpenAIVideoRequestToIR,
	encodeVideoIRToOpenAIResponse,
} from "./video-codec";

describe("video codec (OpenAI edge shape <-> video IR)", () => {
	it("decodes custom video request shape with image_url content parts into video IR", () => {
		const ir = decodeOpenAIVideoRequestToIR({
			model: "google/veo-3.1-fast-preview",
			prompt: "Cinematic mountain flight",
			duration: 8,
			size: "1280x720",
			aspect_ratio: "16:9",
			sample_count: 2,
			input_references: [
				{
					type: "image_url",
					image_url: {
						url: "https://example.com/reference.png",
					},
				},
				{
					type: "image_url",
					role: "reference",
					reference_type: "style",
					image_url: {
						url: "https://example.com/style.png",
					},
				},
			],
			generate_audio: true,
			enhance_prompt: true,
		});

		expect(ir.model).toBe("google/veo-3.1-fast-preview");
		expect(ir.prompt).toContain("Cinematic");
		expect(ir.seconds).toBe(8);
		expect(ir.size).toBe("1280x720");
		expect(ir.resolution).toBe("1280x720");
		expect(ir.inputReference).toBe("https://example.com/reference.png");
		expect(ir.aspectRatio).toBe("16:9");
		expect(ir.numberOfVideos).toBe(2);
		expect(Array.isArray(ir.referenceImages)).toBe(true);
		expect(ir.generateAudio).toBe(true);
		expect(ir.enhancePrompt).toBe(true);
		expect(ir.outputAccess).toBe("both");
	});

	it("maps provider params and output/webhook controls into video IR", () => {
		const ir = decodeOpenAIVideoRequestToIR({
			model: "google/veo-3.1-generate-preview",
			prompt: "A wide landscape sunrise.",
			aspect_ratio: "21:9",
			compression_quality: 85,
			duration: 7,
			generate_audio: true,
			negative_prompt: "low detail",
			resolution: "1080p",
			output: {
				access: "signed_url",
			},
			webhook: {
				endpointId: "whep_video",
				events: ["video.completed"],
			},
			provider_params: {
				storageUri: "gs://bucket/output/",
			},
		});

		expect(ir.aspectRatio).toBe("21:9");
		expect(ir.compressionQuality).toBe(85);
		expect(ir.durationSeconds).toBe(7);
		expect(ir.generateAudio).toBe(true);
		expect(ir.negativePrompt).toBe("low detail");
		expect(ir.size).toBe("1080p");
		expect(ir.resolution).toBe("1080p");
		expect(ir.outputAccess).toBe("signed_url");
		expect(ir.callbackUrl).toBeUndefined();
		expect(ir.webhook).toMatchObject({ endpointId: "whep_video" });
		expect(ir.outputStorageUri).toBe("gs://bucket/output/");
	});

	it("decodes source video and audio references without dropping them", () => {
		const ir = decodeOpenAIVideoRequestToIR({
			model: "bytedance/seedance-2.0",
			prompt: "Reference the supplied media",
			input_video_duration: 8.5,
			input_references: [
				{ type: "video_url", role: "source", media_url: { url: "https://example.com/source.mp4" } },
				{ type: "audio_url", role: "reference", media_url: { url: "https://example.com/music.mp3" } },
			],
		});
		expect(ir.inputVideo).toBe("https://example.com/source.mp4");
		expect(ir.inputVideoDurationSeconds).toBe(8.5);
		expect(ir.inputReferences?.map((entry) => entry.type)).toEqual(["video", "audio"]);
		expect(ir.referenceImages).toEqual([]);
	});

	it("keeps audio references out of legacy image and video aliases", () => {
		const ir = decodeOpenAIVideoRequestToIR({
			model: "bytedance/seedance-2.0",
			prompt: "Use the supplied soundtrack",
			input_audio_duration: 12.5,
			input_references: [
				{ type: "audio_url", role: "source", media_url: { url: "https://example.com/music.mp3" } },
				{ type: "audio_url", role: "reference", media_url: { url: "https://example.com/voice.mp3" } },
			],
		});

		expect(ir.inputVideo).toBeUndefined();
		expect(ir.referenceImages).toEqual([]);
		expect(ir.inputReferences?.map((entry) => entry.type)).toEqual(["audio", "audio"]);
		expect(ir.inputAudioDurationSeconds).toBe(12.5);
	});

	it("encodes video IR response back to public video job shape", () => {
		const response = encodeVideoIRToOpenAIResponse(
			{
				id: "req_123",
				nativeId: "op_abc",
				model: "google/veo-3.1-generate-preview",
				provider: "google-ai-studio",
				status: "queued",
				progress: 0,
				createdAt: 1_712_697_600,
				seconds: "8",
				size: "1280x720",
			},
			"req_123",
		);

		expect(response.id).toBe("req_123");
		expect(response).toMatchObject({
			id: "req_123",
			object: "video",
			status: "queued",
			progress: 0,
			created_at: 1_712_697_600,
			seconds: "8",
			size: "1280x720",
		});
		expect(response.polling_url).toBeUndefined();
	});

	it("decodes native OpenAI seconds and input_reference", () => {
		const ir = decodeOpenAIVideoRequestToIR({
			prompt: "Animate this reference",
			model: "sora-2",
			seconds: "12",
			input_reference: { file_id: "file_reference" },
		});
		expect(ir.seconds).toBe(12);
		expect(ir.inputReference).toEqual({ file_id: "file_reference" });
	});
});
