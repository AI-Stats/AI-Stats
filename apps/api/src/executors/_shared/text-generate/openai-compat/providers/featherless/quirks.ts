// Purpose: Preserve Featherless's documented vLLM and reasoning extensions.
// Why: These fields have no complete provider-neutral OpenAI representation.

import type { ProviderQuirks } from "../../quirks/types";

const EXTENSION_FIELDS = [
	"min_p",
	"stop_token_ids",
	"include_stop_str_in_output",
	"min_tokens",
	"chat_template_kwargs",
] as const;

export const featherlessQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir }) => {
		const options = ir.vendor?.featherless;
		if (options && typeof options === "object") {
			for (const field of EXTENSION_FIELDS) {
				if (options[field] !== undefined) request[field] = options[field];
			}
		}

		if (request.chat_template_kwargs == null && ir.reasoning) {
			const enabled = ir.reasoning.enabled
				?? (typeof ir.reasoning.effort === "string" ? ir.reasoning.effort !== "none" : undefined);
			if (enabled !== undefined || ir.reasoning.maxTokens !== undefined) {
				request.chat_template_kwargs = {
					...(enabled !== undefined ? { enable_thinking: enabled } : {}),
					...(ir.reasoning.maxTokens !== undefined ? { thinking_budget: ir.reasoning.maxTokens } : {}),
				};
			}
		}
	},
	extractReasoning: ({ choice, rawContent }) => {
		const reasoning = choice?.message?.reasoning_content;
		return {
			main: rawContent,
			reasoning: typeof reasoning === "string" && reasoning.length > 0 ? [reasoning] : [],
		};
	},
};
