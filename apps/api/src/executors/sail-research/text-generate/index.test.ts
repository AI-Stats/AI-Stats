import { describe, expect, it } from "vitest";
import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs } from "@executors/types";
import { preprocess } from "./index";
import { irToOpenAIResponses } from "@executors/_shared/text-generate/openai-compat/transform";

function request(serviceTier: string): IRChatRequest {
	return { model: "test/model", messages: [], stream: false, serviceTier };
}

function requestWithoutTier(): IRChatRequest {
	return { model: "test/model", messages: [], stream: false };
}

function args(providerModelSlug: string): ExecutorExecuteArgs {
	return {
		providerModelSlug,
		capabilityParams: { params: ["service_tier", "metadata"] },
	} as ExecutorExecuteArgs;
}

describe("Sail Research completion windows", () => {
	it("uses the canonical OpenAI Responses input field", () => {
		const payload = irToOpenAIResponses(request("standard"), "zai-org/GLM-5.2-FP8", "sail-research");
		expect(payload.input).toEqual([]);
		expect(payload.input_items).toBeUndefined();
	});

	it("maps standard to balanced when the model offers it", () => {
		expect(preprocess(request("standard"), args("zai-org/GLM-5.2-FP8"))).toMatchObject({
			metadata: { completion_window: "balanced" },
		});
	});

	it("maps an omitted tier to the standard completion window", () => {
		expect(preprocess(requestWithoutTier(), args("zai-org/GLM-5.2-FP8"))).toMatchObject({
			metadata: { completion_window: "balanced" },
		});
		expect(preprocess(requestWithoutTier(), args("deepseek/deepseek-v4-flash-0731"))).toMatchObject({
			metadata: { completion_window: "asap" },
		});
	});

	it("maps standard to asap when balanced is unavailable", () => {
		expect(preprocess(request("standard"), args("deepseek/deepseek-v4-flash-0731"))).toMatchObject({
			metadata: { completion_window: "asap" },
		});
	});

	it.each([["priority", "asap"], ["flex", "flex"]])("maps %s to %s", (tier, expected) => {
		const result = preprocess(request(tier), args("zai-org/GLM-5.2-FP8"));
		expect(result.metadata).toEqual({ completion_window: expected });
		expect(result.serviceTier).toBeUndefined();
	});
});
