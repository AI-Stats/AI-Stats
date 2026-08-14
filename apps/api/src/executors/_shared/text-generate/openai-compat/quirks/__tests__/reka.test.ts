import { describe, expect, it } from "vitest";
import { rekaQuirks } from "../../providers/reka/quirks";

describe("Reka OpenAI-compatible quirks", () => {
	it("maps forced tool choice and URL media to Reka's documented wire shape", () => {
		const request: any = {
			tool_choice: "required",
			messages: [{
				role: "user",
				content: [
					{ type: "video_url", video_url: { url: "https://example.com/clip.mp4" } },
					{ type: "input_audio", input_audio: { url: "https://example.com/audio.mp3" } },
				],
			}],
		};
		rekaQuirks.transformRequest?.({ request, ir: {} as any, model: "reka-flash" });
		expect(request.tool_choice).toBe("tool");
		expect(request.messages[0].content).toEqual([
			{ type: "video_url", video_url: "https://example.com/clip.mp4" },
			{ type: "audio_url", audio_url: "https://example.com/audio.mp3" },
		]);
	});
});
