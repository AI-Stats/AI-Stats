import { describe, expect, it } from "vitest";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import { zaiQuirks } from "../../providers/z-ai/quirks";
import { supportsAdapterBackedCapability } from "@providers/capabilities";
import { getProviderProfile } from "@providers/providerProfiles";

describe("Z.AI quirks", () => {
	it("preserves the documented streaming tool-call switch through IR", () => {
		const ir = decodeOpenAIChatRequest({
			model: "glm-5.1",
			messages: [{ role: "user", content: "weather" }],
			stream: true,
			tool_stream: true,
		} as any);
		const request: Record<string, any> = { messages: [] };
		zaiQuirks.transformRequest?.({ request, ir });
		expect(request.tool_stream).toBe(true);
	});

	it("normalizes developer messages and the thinking toggle", () => {
		const request: Record<string, any> = {
			messages: [{ role: "developer", content: "policy" }],
		};
		zaiQuirks.transformRequest?.({
			request,
			ir: { reasoning: { enabled: false } } as any,
		});
		expect(request.messages[0].role).toBe("system");
		expect(request.thinking).toEqual({ type: "disabled", clear_thinking: false });
	});

	it("shares the audited text policy across aliases without claiming native media adapters", () => {
		expect(getProviderProfile("zai")?.id).toBe("z-ai");
		expect(getProviderProfile("z-ai")?.text?.normalize?.maxTemperature).toBe(1);
		expect(supportsAdapterBackedCapability("z-ai", "video.generate")).toBe(false);
		expect(supportsAdapterBackedCapability("zai", "audio.transcription")).toBe(false);
	});
});
