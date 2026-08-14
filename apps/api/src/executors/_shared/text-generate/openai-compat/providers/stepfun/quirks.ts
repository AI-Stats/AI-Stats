// StepFun emits reasoning in `reasoning` and the DeepSeek-compatible
// `reasoning_content` field. Normalize either shape into gateway IR.

import type { ProviderQuirks } from "../../quirks/types";

export const stepFunQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir }) => {
		const stepFunOptions = (ir.vendor as any)?.stepfun;
		if (stepFunOptions?.n !== undefined) request.n = stepFunOptions.n;
		if (stepFunOptions?.reasoning_format === "general" || stepFunOptions?.reasoning_format === "deepseek-style") {
			request.reasoning_format = stepFunOptions.reasoning_format;
		}
	},

	extractReasoning: ({ choice, rawContent }) => {
		const reasoning = choice.message?.reasoning_content ?? choice.message?.reasoning;
		return {
			main: rawContent,
			reasoning: typeof reasoning === "string" && reasoning.length > 0 ? [reasoning] : [],
		};
	},

	transformStreamChunk: ({ chunk }) => {
		for (const choice of chunk?.choices ?? []) {
			if (typeof choice?.delta?.reasoning === "string" && choice.delta.reasoning_content == null) {
				choice.delta.reasoning_content = choice.delta.reasoning;
			}
			if (typeof choice?.message?.reasoning === "string" && choice.message.reasoning_content == null) {
				choice.message.reasoning_content = choice.message.reasoning;
			}
		}
	},
};
