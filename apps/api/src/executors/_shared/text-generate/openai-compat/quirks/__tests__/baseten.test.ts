// Purpose: Shared OpenAI-compatible text adapter and transformations.
// Why: Consolidates OpenAI-style quirks across many providers.
// How: Maps IR to OpenAI formats and normalizes streaming events.

import { describe, expect, it } from "vitest";
import { basetenQuirks } from "../../providers/baseten/quirks";

describe("Baseten quirks", () => {
	it("maps reasoning.enabled=true to chat_template_args.enable_thinking=true", () => {
		const request: Record<string, unknown> = {};
		const ir: any = {
			reasoning: {
				enabled: true,
			},
		};

		basetenQuirks.transformRequest?.({ request, ir });

		expect(request.chat_template_args).toEqual({
			enable_thinking: true,
		});
	});

	it("maps reasoning.enabled=false to chat_template_args.enable_thinking=false", () => {
		const request: Record<string, unknown> = {};
		const ir: any = {
			reasoning: {
				enabled: false,
			},
		};

		basetenQuirks.transformRequest?.({ request, ir });

		expect(request.chat_template_args).toEqual({
			enable_thinking: false,
		});
	});

	it("maps reasoning.effort=none to chat_template_args.enable_thinking=false", () => {
		const request: Record<string, unknown> = {};
		const ir: any = {
			reasoning: {
				effort: "none",
			},
		};

		basetenQuirks.transformRequest?.({ request, ir });

		expect(request.chat_template_args).toEqual({
			enable_thinking: false,
		});
	});

	it("maps reasoning.effort=high to chat_template_args.enable_thinking=true", () => {
		const request: Record<string, unknown> = {};
		const ir: any = {
			reasoning: {
				effort: "high",
			},
		};

		basetenQuirks.transformRequest?.({ request, ir });

		expect(request.chat_template_args).toEqual({
			enable_thinking: true,
		});
		expect(request.reasoning_effort).toBe("high");
	});

	it("uses Baseten audio_url and video_url content types", () => {
		const request: Record<string, any> = {
			messages: [{
				role: "user",
				content: [
					{ type: "input_audio", input_audio: { url: "https://example.com/a.wav" } },
					{ type: "input_audio", input_audio: { data: "UklGRg==", format: "wav" } },
					{ type: "input_video", video_url: { url: "https://example.com/v.mp4" } },
				],
			}],
		};

		basetenQuirks.transformRequest?.({ request, ir: {} as any });

			expect(request.messages[0].content).toEqual([
			{ type: "audio_url", audio_url: { url: "https://example.com/a.wav" } },
			{ type: "audio_url", audio_url: { url: "data:audio/wav;base64,UklGRg==" } },
			{ type: "video_url", video_url: { url: "https://example.com/v.mp4" } },
		]);
	});

	it("forwards lower reasoning efforts for faster DeepSeek responses", () => {
		const request: Record<string, unknown> = {};
		const ir: any = {
			reasoning: {
				effort: "minimal",
			},
		};

		basetenQuirks.transformRequest?.({ request, ir });

		expect(request.reasoning_effort).toBe("minimal");
		expect(request.chat_template_args).toEqual({
			enable_thinking: true,
		});
	});

	it("preserves existing chat_template_args keys", () => {
		const request: Record<string, any> = {
			chat_template_args: {
				other_flag: "x",
			},
		};
		const ir: any = {
			reasoning: {
				enabled: true,
			},
		};

		basetenQuirks.transformRequest?.({ request, ir });

		expect(request.chat_template_args).toEqual({
			other_flag: "x",
			enable_thinking: true,
		});
	});

	it("does not mutate request when reasoning is absent", () => {
		const request: Record<string, unknown> = {};
		const ir: any = {};

		basetenQuirks.transformRequest?.({ request, ir });

		expect(request.chat_template_args).toBeUndefined();
	});

	it("does not forward Phaseo's service tier to Baseten", () => {
		const request: Record<string, unknown> = {
			service_tier: "priority",
		};
		const ir: any = {};

		basetenQuirks.transformRequest?.({ request, ir });

		expect(request.service_tier).toBeUndefined();
	});
});
