// Purpose: Map Inference.net's documented reasoning contract through shared Chat IR.

import type { ProviderQuirks } from "../../quirks/types";

export const inferenceNetQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir }) => {
		if (request.reasoning_effort != null || !ir.reasoning) return;
		const effort = ir.reasoning.effort
			?? (ir.reasoning.enabled === false ? "none" : ir.reasoning.enabled === true ? "medium" : undefined);
		if (effort !== undefined) request.reasoning_effort = effort;
	},
	extractReasoning: ({ choice, rawContent }) => {
		const reasoning = choice?.message?.reasoning_content;
		return {
			main: rawContent,
			reasoning: typeof reasoning === "string" && reasoning.length > 0 ? [reasoning] : [],
		};
	},
};
