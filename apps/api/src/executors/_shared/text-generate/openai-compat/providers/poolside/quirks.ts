// Poolside-hosted inference uses vLLM-style thinking controls and reasoning output.
// https://docs.poolside.ai/api/openai-api-examples

import type { ProviderQuirks } from "../../quirks/types";

export const poolsideQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir }) => {
		const enabled = ir.reasoning?.enabled ?? (
			typeof ir.reasoning?.effort === "string"
				? ir.reasoning.effort !== "none"
				: undefined
		);
		if (enabled !== undefined) {
			request.chat_template_kwargs = {
				...(request.chat_template_kwargs ?? {}),
				enable_thinking: enabled,
			};
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
