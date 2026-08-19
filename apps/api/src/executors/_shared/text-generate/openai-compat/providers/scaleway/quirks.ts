import type { ProviderQuirks } from "../../quirks/types";

const UNSUPPORTED = [
	"background", "conversation", "include", "instructions", "max_tool_calls", "metadata",
	"previous_response_id", "prompt", "prompt_cache_key", "safety_identifier", "service_tier",
	"stream_options", "top_logprobs", "user", "verbosity", "store", "web_search_options",
	"modalities", "image_config",
];

export const scalewayQuirks: ProviderQuirks = {
	transformRequest: ({ request }) => {
		if (!request || typeof request !== "object") return;
		for (const field of UNSUPPORTED) delete request[field];
		if (Array.isArray(request.tools)) {
			request.tools = request.tools.filter((tool: any) => tool?.type === "function");
		}
	},
};
