import { describe, expect, it } from "vitest";
import { extractRequestedParams, getUnknownTopLevelParams } from "./paramCapabilities";
import { resolveProviderParamSupportOverride } from "./textParamPolicy";

describe("Mancer text parameter policy", () => {
	it("recognizes documented Mancer chat extensions", () => {
		const body = {
			model: "mancer/deepseek-v4-flash",
			messages: [{ role: "user", content: "hello" }],
			respond_as: { role: "continue" },
			min_tokens: 4,
			dynatemp_mode: 1,
			dry_multiplier: 0.8,
			custom_timeout: 30,
			allow_logging: false,
		};

		expect(getUnknownTopLevelParams("chat.completions", body)).toEqual([]);
		expect(extractRequestedParams("chat.completions", body)).toEqual([
			"respond_as",
			"min_tokens",
			"dynatemp_mode",
			"dry_multiplier",
			"custom_timeout",
			"allow_logging",
		]);
		for (const param of extractRequestedParams("chat.completions", body)) {
			expect(resolveProviderParamSupportOverride("mancer", param)).toBe(true);
		}
	});
});
