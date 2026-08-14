// Purpose: Shared OpenAI-compatible text adapter and transformations.
// Why: Consolidates OpenAI-style quirks across many providers.
// How: Maps IR to OpenAI formats and normalizes streaming events.

// Z.AI Quirks Tests
import { describe, expect, it } from "vitest";
import { decodeOpenAIChatRequest } from "@protocols/openai-chat/decode";
import { supportsAdapterBackedCapability } from "@providers/capabilities";
import { getProviderProfile } from "@providers/providerProfiles";
import { zaiQuirks } from "../../providers/z-ai/quirks";

describe("Z.AI Quirks", () => {
	describe("transformRequest", () => {
		it("maps developer role to system", () => {
			const request: Record<string, any> = {
				messages: [
					{ role: "developer", content: "use strict json" },
					{ role: "user", content: "hello" },
				],
			};

			zaiQuirks.transformRequest!({
				request,
				ir: {} as any,
			});

			expect(request.messages[0].role).toBe("system");
			expect(request.messages[0].content).toBe("use strict json");
			expect(request.messages[1].role).toBe("user");
		});

		it("enables thinking when reasoning.enabled=true", () => {
			const request: Record<string, any> = {};
			zaiQuirks.transformRequest!({
				request,
				ir: { reasoning: { enabled: true } } as any,
			});
			expect(request.thinking).toEqual({
				type: "enabled",
				clear_thinking: false,
			});
		});

		it("disables thinking when reasoning.enabled=false", () => {
			const request: Record<string, any> = {};
			zaiQuirks.transformRequest!({
				request,
				ir: { reasoning: { enabled: false } } as any,
			});
			expect(request.thinking).toEqual({
				type: "disabled",
				clear_thinking: false,
			});
		});

		it.each([
			["none", "low"],
			["minimal", "low"],
			["low", "low"],
			["medium", "high"],
			["high", "high"],
			["xhigh", "max"],
			["max", "max"],
		])("maps GLM-5.3 effort %s to %s", (effort, expected) => {
			const request: Record<string, any> = { model: "glm-5.3" };
			zaiQuirks.transformRequest!({
				request,
				ir: { reasoning: { effort } } as any,
			});

			expect(request.thinking).toEqual({
				type: "enabled",
				clear_thinking: false,
			});
			expect(request.reasoning_effort).toBe(expected);
		});

		it("maps disabled thinking to low for GLM-5.3", () => {
			const request: Record<string, any> = { model: "glm-5.3[1m]" };
			zaiQuirks.transformRequest!({
				request,
				ir: { reasoning: { enabled: false } } as any,
			});

			expect(request.thinking.type).toBe("enabled");
			expect(request.reasoning_effort).toBe("low");
		});
	});

	describe("normalizeResponse", () => {
		it("should convert first message to reasoning when there are 2+ messages", () => {
			const response = {
				output: [
					{
						type: "message",
						id: "msg_1",
						role: "assistant",
						content: [{ type: "output_text", text: "Thinking..." }],
					},
					{
						type: "message",
						id: "msg_2",
						role: "assistant",
						content: [{ type: "output_text", text: "Answer..." }],
					},
				],
			};

			zaiQuirks.normalizeResponse!({ response, ir: null as any });

			expect(response.output[0].type).toBe("reasoning");
			expect(response.output[1].type).toBe("message");
		});

		it("should handle output_items instead of output", () => {
			const response = {
				output_items: [
					{
						type: "message",
						id: "msg_1",
						content: [{ type: "output_text", text: "Thinking..." }],
					},
					{
						type: "message",
						id: "msg_2",
						content: [{ type: "output_text", text: "Answer..." }],
					},
				],
			};

			zaiQuirks.normalizeResponse!({ response, ir: null as any });

			expect(response.output_items[0].type).toBe("reasoning");
			expect(response.output_items[1].type).toBe("message");
		});

		it("should not modify when there is only 1 message", () => {
			const response = {
				output: [
					{
						type: "message",
						id: "msg_1",
						content: [{ type: "output_text", text: "Answer..." }],
					},
				],
			};

			zaiQuirks.normalizeResponse!({ response, ir: null as any });

			expect(response.output[0].type).toBe("message");
		});

		it("should not modify when there are already reasoning items", () => {
			const response = {
				output: [
					{
						type: "reasoning",
						id: "reasoning_1",
						content: [{ type: "output_text", text: "Thinking..." }],
					},
					{
						type: "message",
						id: "msg_1",
						content: [{ type: "output_text", text: "Answer..." }],
					},
				],
			};

			zaiQuirks.normalizeResponse!({ response, ir: null as any });

			expect(response.output[0].type).toBe("reasoning");
			expect(response.output[1].type).toBe("message");
		});
	});
});

describe("Z.AI audited gateway contract", () => {
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

	it("shares the audited text policy across aliases without claiming native media adapters", () => {
		expect(getProviderProfile("zai")?.id).toBe("z-ai");
		expect(getProviderProfile("z-ai")?.text?.normalize?.maxTemperature).toBe(1);
		expect(supportsAdapterBackedCapability("z-ai", "video.generate")).toBe(false);
		expect(supportsAdapterBackedCapability("zai", "audio.transcription")).toBe(false);
	});
});
