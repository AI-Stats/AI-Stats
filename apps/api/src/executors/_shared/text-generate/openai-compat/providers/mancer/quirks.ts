// Mancer's OpenAI-compatible API adds sampler and execution controls that do
// not have provider-neutral IR fields. Preserve those validated extensions
// from the original public request when targeting Mancer.

import type { ProviderQuirks } from "../../quirks/types";

const MANCER_EXTENSION_FIELDS = [
	"n",
	"respond_as",
	"min_tokens",
	"custom_token_bans",
	"dynatemp_mode",
	"dynatemp_min",
	"dynatemp_max",
	"dynatemp_exponent",
	"epsilon_cutoff",
	"top_a",
	"typical_p",
	"eta_cutoff",
	"tfs",
	"smoothing_factor",
	"smoothing_curve",
	"xtc_probability",
	"xtc_threshold",
	"dry_multiplier",
	"dry_base",
	"dry_allowed_length",
	"dry_range",
	"dry_sequence_breakers",
	"ignore_eos",
	"custom_timeout",
	"allow_logging",
] as const;

export const mancerQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir }) => {
		if (!request || typeof request !== "object") return;

		const raw = ir.rawRequest && typeof ir.rawRequest === "object" && !Array.isArray(ir.rawRequest)
			? ir.rawRequest as Record<string, unknown>
			: {};
		for (const field of MANCER_EXTENSION_FIELDS) {
			if (raw[field] !== undefined) request[field] = raw[field];
		}

		if (typeof ir.reasoning?.enabled === "boolean") {
			request.reasoning = { enabled: ir.reasoning.enabled };
		}

		// Mancer currently accepts only `auto` (or null) for this field.
		if (request.tool_choice !== undefined && request.tool_choice !== "auto") {
			delete request.tool_choice;
		}
	},

	transformStreamChunk: ({ chunk }) => {
		if (!chunk || typeof chunk !== "object") return;
		const inputTokens = chunk["x-input-tokens"];
		const outputTokens = chunk["x-output-tokens"];
		if (typeof inputTokens !== "number" && typeof outputTokens !== "number") return;
		const promptTokens = typeof inputTokens === "number" ? inputTokens : 0;
		const completionTokens = typeof outputTokens === "number" ? outputTokens : 0;
		chunk.usage = {
			...(chunk.usage && typeof chunk.usage === "object" ? chunk.usage : {}),
			prompt_tokens: promptTokens,
			completion_tokens: completionTokens,
			total_tokens: promptTokens + completionTokens,
			...(typeof chunk["x-spent-credits"] === "number"
				? { "x-spent-credits": chunk["x-spent-credits"] }
				: {}),
		};
	},
};
