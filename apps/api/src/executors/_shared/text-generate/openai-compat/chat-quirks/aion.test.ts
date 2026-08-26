import { describe, expect, it } from "vitest";
import type { IRChatRequest } from "@core/ir";
import { aionChatQuirk } from "./aion";
import { aionQuirks } from "../providers/aion-labs/quirks";

function request(model: string, reasoning?: IRChatRequest["reasoning"]): IRChatRequest {
	return {
		model,
		stream: false,
		messages: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
		reasoning,
	};
}

describe("Aion Labs current API quirks", () => {
	it.each([
		["none", "none"],
		["minimal", "low"],
		["low", "low"],
		["medium", "medium"],
		["high", "high"],
		["xhigh", "high"],
		["max", "high"],
	] as const)("maps Aion 2.0 reasoning effort %s to %s", (effort, expected) => {
		const ir = request("aion-labs/aion-2.0", { effort });
		const wire: Record<string, unknown> = { model: ir.model };
		aionChatQuirk.onRequest?.({ ir, providerId: "aion-labs", model: ir.model, request: wire });

		expect(wire.reasoning_effort).toBe(expected);
		expect(wire.reasoning_split).toBe(true);
	});

	it("does not send the Aion 2.0-only effort field to other models", () => {
		const ir = request("aion-labs/aion-3.0", { effort: "high" });
		const wire: Record<string, unknown> = { model: ir.model };
		aionChatQuirk.onRequest?.({ ir, providerId: "aionlabs", model: ir.model, request: wire });

		expect(wire.reasoning_effort).toBeUndefined();
		expect(wire.reasoning_split).toBe(true);
	});

	it("maps the documented streamed reasoning field into normalized reasoning deltas", () => {
		const chunk: any = {
			object: "chat.completion.chunk",
			choices: [{ index: 0, delta: { reasoning: "private chain" }, finish_reason: null }],
		};
		aionQuirks.transformStreamChunk?.({ chunk, accumulated: { requestId: "req_aion" } });

		expect(chunk.choices[0].delta.reasoning_content).toBe("private chain");
	});

	it("extracts the documented non-streaming message.reasoning field", () => {
		const result = aionChatQuirk.onResponse?.({
			providerId: "aion-labs",
			rawContent: "Visible answer",
			choice: { message: { reasoning: "private chain", content: "Visible answer" } },
		});

		expect(result).toEqual({ main: "Visible answer", reasoning: ["private chain"] });
	});
});
