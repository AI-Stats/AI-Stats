import type { ProviderQuirks } from "../../quirks/types";

const UNSUPPORTED_FIELDS = [
	"tools", "tool_choice", "parallel_tool_calls", "max_tool_calls",
	"response_format", "frequency_penalty", "presence_penalty", "logit_bias",
	"logprobs", "top_logprobs", "top_k", "min_p", "repetition_penalty",
	"seed", "stop", "n", "user", "stream_options", "modalities",
	"image_config", "audio", "prompt_cache_key", "prompt_cache_retention",
	"prompt_cache_options", "service_tier", "metadata", "background",
	"safety_identifier",
] as const;

export const longCatQuirks: ProviderQuirks = {
	transformRequest: ({ ir, request }) => {
		for (const field of UNSUPPORTED_FIELDS) delete request[field];
		const reasoning = ir.reasoning;
		if (reasoning) {
			const enabled = reasoning.enabled ?? reasoning.effort !== "none";
			request.thinking = { type: enabled ? "enabled" : "disabled" };
		}
		delete request.reasoning;
		delete request.reasoning_effort;
	},
	extractReasoning: ({ choice, rawContent }) => {
		const reasoning = choice?.message?.reasoning_content;
		return {
			main: rawContent,
			reasoning: typeof reasoning === "string" && reasoning.length > 0 ? [reasoning] : [],
		};
	},
};
