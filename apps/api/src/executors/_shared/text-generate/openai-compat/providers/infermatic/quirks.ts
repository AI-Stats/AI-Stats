import type { ProviderQuirks } from "../../quirks/types";

const UNSUPPORTED_CHAT_FIELDS = [
	"tools", "tool_choice", "parallel_tool_calls", "max_tool_calls",
	"response_format", "reasoning_effort", "reasoning", "thinking",
	"modalities", "image_config", "audio", "prompt_cache_key",
	"prompt_cache_retention", "prompt_cache_options", "service_tier",
	"metadata", "background", "safety_identifier", "stream_options",
] as const;

export const infermaticQuirks: ProviderQuirks = {
	transformRequest: ({ request }) => {
		for (const field of UNSUPPORTED_CHAT_FIELDS) delete request[field];
	},
};
