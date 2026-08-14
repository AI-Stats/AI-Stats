import type { ProviderQuirks } from "../../quirks/types";

const IGNORED_OPENAI_FIELDS = [
	"logprobs",
	"top_logprobs",
	"n",
	"presence_penalty",
	"frequency_penalty",
	"logit_bias",
	"seed",
] as const;

export const maraQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir, model }) => {
		for (const field of IGNORED_OPENAI_FIELDS) delete request[field];

		const jsonSchema = request.response_format?.type === "json_schema"
			? request.response_format.json_schema
			: null;
		if (jsonSchema && typeof jsonSchema === "object") {
			// MARA documents JSON Schema support with strict=false; strict=true is not supported.
			jsonSchema.strict = false;
		}

		// MARA documents reasoning_effort=high for its gpt-oss-120b tool-calling path.
		if (
			String(model ?? request.model ?? "").toLowerCase() === "gpt-oss-120b"
			&& ir.reasoning?.effort === "high"
		) {
			request.reasoning_effort = "high";
		}
	},
};
