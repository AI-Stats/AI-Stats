// W&B Serverless Inference exposes reasoning in `reasoning` and controls
// switchable thinking models through chat_template_kwargs.enable_thinking.
// https://docs.wandb.ai/inference/response-settings/reasoning

import type { ProviderQuirks } from "../../quirks/types";

export const weightsAndBiasesQuirks: ProviderQuirks = {
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
		const reasoning = choice.message?.reasoning ?? choice.message?.reasoning_content;
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
