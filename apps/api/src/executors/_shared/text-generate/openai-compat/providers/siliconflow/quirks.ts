// SiliconFlow Chat exposes provider-specific thinking controls and reasoning output.
// https://docs.siliconflow.com/en/api-reference/chat-completions/chat-completions

import type { ProviderQuirks } from "../../quirks/types";

export const siliconFlowQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir }) => {
		const enabled = ir.reasoning?.enabled ?? (
			typeof ir.reasoning?.effort === "string"
				? ir.reasoning.effort !== "none"
				: undefined
		);
		if (enabled !== undefined) request.enable_thinking = enabled;
		if (typeof ir.reasoning?.maxTokens === "number") {
			request.thinking_budget = ir.reasoning.maxTokens;
		}
	},

	extractReasoning: ({ choice, rawContent }) => {
		const reasoning = choice.message?.reasoning_content;
		return {
			main: rawContent,
			reasoning: typeof reasoning === "string" && reasoning.length > 0
				? [reasoning]
				: [],
		};
	},
};
