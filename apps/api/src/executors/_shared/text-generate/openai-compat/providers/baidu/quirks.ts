// Purpose: Map Qianfan v2 thinking controls that have no exact OpenAI equivalent.
// Why: Qianfan documents separate Chat and Responses reasoning fields.
// How: Uses the generated request shape to select the matching v2 contract.

import type { ProviderQuirks } from "../../quirks/types";

function isRecord(value: unknown): value is Record<string, any> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeReasoningEffort(value: unknown): "high" | "max" | undefined {
	if (value === "max" || value === "xhigh") return "max";
	if (value === "low" || value === "medium" || value === "high") return "high";
	return undefined;
}

export const baiduQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir }) => {
		const raw = isRecord(ir.rawRequest) ? ir.rawRequest : {};
		const isResponsesRequest = "input" in request;

		if (raw.penalty_score !== undefined) request.penalty_score = raw.penalty_score;

		if (isResponsesRequest) {
			if (isRecord(raw.thinking)) {
				request.thinking = raw.thinking;
			} else if (ir.reasoning?.enabled !== undefined || ir.reasoning?.effort !== undefined) {
				const enabled = ir.reasoning.enabled ?? ir.reasoning.effort !== "none";
				request.thinking = { type: enabled ? "enabled" : "disabled" };
			}
			if (raw.expire_at !== undefined) request.expire_at = raw.expire_at;
			return;
		}

		const enabled = raw.enable_thinking ?? (
			ir.reasoning?.enabled !== undefined
				? ir.reasoning.enabled
				: ir.reasoning?.effort !== undefined
					? ir.reasoning.effort !== "none"
					: undefined
		);
		if (enabled !== undefined) request.enable_thinking = enabled;

		const budget = raw.thinking_budget ?? ir.reasoning?.maxTokens;
		if (budget !== undefined) request.thinking_budget = budget;
		if (raw.thinking_strategy !== undefined) request.thinking_strategy = raw.thinking_strategy;

		const effort = normalizeReasoningEffort(raw.reasoning_effort ?? ir.reasoning?.effort);
		if (effort !== undefined) request.reasoning_effort = effort;
	},
};
