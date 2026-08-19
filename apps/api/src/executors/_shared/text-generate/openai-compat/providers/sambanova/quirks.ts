import type { ProviderQuirks } from "../../quirks/types";

const UNSUPPORTED_FIELDS = [
	"presence_penalty",
	"frequency_penalty",
	"logit_bias",
	"parallel_tool_calls",
	"max_tool_calls",
	"service_tier",
	"metadata",
	"store",
	"background",
	"previous_response_id",
	"prompt_cache_key",
	"prompt_cache_retention",
	"safety_identifier",
	"web_search_options",
	"modalities",
	"image_config",
];

export const sambaNovaQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir }) => {
		if (!request || typeof request !== "object") return;
		for (const field of UNSUPPORTED_FIELDS) delete request[field];
		if (request.top_k == null && typeof ir.topK === "number") request.top_k = ir.topK;
		if (
			request.reasoning == null &&
			ir.reasoning?.effort &&
			["low", "medium", "high"].includes(ir.reasoning.effort)
		) {
			request.reasoning = { effort: ir.reasoning.effort };
		}
		if (typeof request.n === "number" && (request.n < 1 || request.n > 8)) {
			throw new Error("sambanova_n_out_of_range");
		}
		if (
			typeof request.n === "number" && request.n > 1 &&
			(Array.isArray(request.tools) && request.tools.length > 0)
		) {
			throw new Error("sambanova_n_with_tools_unsupported");
		}
	},
};
