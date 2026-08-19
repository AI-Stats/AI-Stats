import { describe, expect, it } from "vitest";
import { chutesQuirks } from "../../providers/chutes/quirks";
import { irToOpenAIChat } from "../../transform-chat";

describe("Chutes quirks", () => {
	it("rewrites audio and video parts to the documented Chutes content types", () => {
		const request: any = {
			messages: [{
				role: "user",
				content: [
					{ type: "input_audio", input_audio: { data: "YWJj", format: "mp3" } },
					{ type: "input_video", video_url: { url: "https://example.com/video.mp4" } },
				],
			}],
		};

		chutesQuirks.transformRequest?.({ request, ir: {} as any });

		expect(request.messages[0].content).toEqual([
			{ type: "audio_url", audio_url: { url: "data:audio/mpeg;base64,YWJj" } },
			{ type: "video_url", video_url: { url: "https://example.com/video.mp4" } },
		]);
	});

	it("preserves explicit template options and maps neutral Kimi reasoning", () => {
		const request: any = { model: "moonshotai/Kimi-K2.6-TEE", messages: [] };
		chutesQuirks.transformRequest?.({
			request,
			model: request.model,
			ir: {
				reasoning: { enabled: false },
				rawRequest: { chat_template_kwargs: { custom_flag: true } },
			} as any,
		});

		expect(request.chat_template_kwargs).toEqual({ custom_flag: true, thinking: false });
	});

	it("maps neutral Nemotron reasoning to enable_thinking", () => {
		const request: any = { model: "Nemotron-3-Nano-Omni-30B-TEE", messages: [] };
		chutesQuirks.transformRequest?.({
			request,
			model: request.model,
			ir: { reasoning: { effort: "high" } } as any,
		});

		expect(request.chat_template_kwargs).toEqual({ enable_thinking: true });
	});

	it("applies Chutes multimodal rewrites through the registered IR encoder", () => {
		const request = irToOpenAIChat({
			model: "Nemotron-3-Nano-Omni-30B-TEE",
			stream: false,
			messages: [{
				role: "user",
				content: [
					{ type: "audio", source: "url", data: "https://example.com/audio.wav", format: "wav" },
					{ type: "video", source: "url", url: "https://example.com/video.mp4" },
				],
			}],
		} as any, "Nemotron-3-Nano-Omni-30B-TEE", "chutes");

		expect(request.messages[0].content).toEqual([
			{ type: "audio_url", audio_url: { url: "https://example.com/audio.wav" } },
			{ type: "video_url", video_url: { url: "https://example.com/video.mp4" } },
		]);
	});
});
