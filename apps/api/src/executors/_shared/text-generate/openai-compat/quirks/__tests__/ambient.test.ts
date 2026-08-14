import { describe, expect, it } from "vitest";
import { ambientQuirks } from "../../providers/ambient/quirks";

describe("ambient request quirks", () => {
	it("preserves documented Ambient extensions across the IR bridge", () => {
		const request: Record<string, unknown> = {};
		ambientQuirks.transformRequest?.({
			request,
			ir: {
				rawRequest: {
					emit_usage: true,
					emit_verified: true,
					emit_ambient_events: true,
					wait_for_verification: true,
					enabled_tools: ["websearch", "calculator"],
					force_auction_v2: false,
					guided_json: { type: "object" },
					thinking_budget: 2048,
					undocumented: "drop me",
				},
			} as any,
		});

		expect(request).toEqual({
			emit_usage: true,
			emit_verified: true,
			emit_ambient_events: true,
			wait_for_verification: true,
			enabled_tools: ["websearch", "calculator"],
			force_auction_v2: false,
			guided_json: { type: "object" },
			thinking_budget: 2048,
		});
	});
});
