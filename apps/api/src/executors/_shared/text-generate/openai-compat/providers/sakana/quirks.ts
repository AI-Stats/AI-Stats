// Purpose: Shared OpenAI-compatible text adapter and transformations.
// Why: Consolidates OpenAI-style quirks across many providers.
// How: Maps IR to OpenAI formats and normalizes streaming events.

import type { ProviderQuirks } from "../../quirks/types";

type SakanaReasoningEffort = "high" | "xhigh" | "max";

function supportsDistinctMax(model?: string | null): boolean {
	const normalized = (model ?? "").split("/").pop()?.toLowerCase();
	return normalized === "fugu-ultra" || normalized === "fugu-ultra-v1.1";
}

function mapReasoningEffortToSakana(
	value?: string,
	model?: string | null,
): SakanaReasoningEffort | undefined {
	switch (value) {
		case "high":
			return "high";
		case "xhigh":
			return "xhigh";
		case "max":
			return supportsDistinctMax(model) ? "max" : "xhigh";
		default:
			return undefined;
	}
}

export const sakanaQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir, model }) => {
		const effort = mapReasoningEffortToSakana(ir.reasoning?.effort, model)
			?? (ir.reasoning?.enabled === true ? "high" : undefined);
		const isResponsesRequest = "input" in request;

		if (isResponsesRequest) {
			if (effort) request.reasoning = { ...(request.reasoning ?? {}), effort };
			delete request.reasoning_effort;
		} else {
			if (effort) request.reasoning_effort = effort;
			delete request.reasoning;
		}
	},
	normalizeResponse: ({ response }) => {
		const usage = response?.usage;
		if (!usage || typeof usage !== "object") return;
		const inputDetails = usage.input_tokens_details ?? usage.prompt_tokens_details;
		const outputDetails = usage.output_tokens_details ?? usage.completion_tokens_details;
		const orchestrationInput = Number(inputDetails?.orchestration_input_tokens ?? 0);
		const orchestrationCached = Number(inputDetails?.orchestration_input_cached_tokens ?? 0);
		const orchestrationOutput = Number(outputDetails?.orchestration_output_tokens ?? 0);
		const inputKey = usage.input_tokens != null ? "input_tokens" : "prompt_tokens";
		const outputKey = usage.output_tokens != null ? "output_tokens" : "completion_tokens";
		const baseInput = Number(usage[inputKey] ?? 0);
		const baseOutput = Number(usage[outputKey] ?? 0);
		const baseCached = Number(inputDetails?.cached_tokens ?? 0);

		usage[inputKey] = baseInput + orchestrationInput;
		usage[outputKey] = baseOutput + orchestrationOutput;
		if (inputDetails) inputDetails.cached_tokens = baseCached + orchestrationCached;
		usage.total_tokens = Math.max(
			Number(usage.total_tokens ?? 0),
			usage[inputKey] + usage[outputKey],
		);
	},
};
