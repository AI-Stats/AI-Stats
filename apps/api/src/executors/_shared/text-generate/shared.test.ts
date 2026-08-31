import { describe, expect, it } from "vitest";
import type { IRChatRequest } from "@core/ir";
import { cherryPickIRParams } from "./shared";

describe("cherryPickIRParams", () => {
	it("preserves snake-case min_p and logit_bias allowlist fields", () => {
		const ir: IRChatRequest = {
			model: "deepseek/deepseek-v4-flash-0731",
			stream: false,
			messages: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
			minP: 0.05,
			logitBias: { "42": 1 },
		};

		const filtered = cherryPickIRParams(ir, { params: ["min_p", "logit_bias"] });

		expect(filtered.minP).toBe(0.05);
		expect(filtered.logitBias).toEqual({ "42": 1 });
	});
});
