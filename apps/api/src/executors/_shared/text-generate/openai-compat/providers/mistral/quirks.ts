// Purpose: Shared OpenAI-compatible text adapter and transformations.
// Why: Consolidates OpenAI-style quirks across many providers.
// How: Maps IR to OpenAI formats and normalizes streaming events.

import type { ProviderQuirks } from "../../quirks/types";

const MISTRAL_UNSUPPORTED_CHAT_FIELDS = [
	"safety_identifier",
	"background",
	"modalities",
	"image_config",
] as const;

export const mistralQuirks: ProviderQuirks = {
	transformRequest: ({ request }) => {
		if (!request || typeof request !== "object") return;

		// Mistral chat schema supports system/user/assistant/tool roles.
		// Normalize OpenAI "developer" role for compatibility.
		if (Array.isArray(request.messages)) {
			request.messages = request.messages.map((msg: any) =>
				msg?.role === "developer"
					? { ...msg, role: "system" }
					: msg,
			);
		}

		// Mistral uses `random_seed` instead of OpenAI's `seed`.
		if (request.seed != null && request.random_seed == null) {
			request.random_seed = request.seed;
		}
		if (request.seed != null) {
			delete request.seed;
		}

		// Phaseo exposes OpenAI-style tier names. Mistral's Priority Tier uses
		// `auto` for priority-with-standard-fallback and `standard_only` to opt out.
		if (request.service_tier === "priority" || request.service_tier === "fast") {
			request.service_tier = "auto";
		} else if (request.service_tier === "standard") {
			request.service_tier = "standard_only";
		} else if (
			request.service_tier !== "auto" &&
			request.service_tier !== "standard_only"
		) {
			delete request.service_tier;
		}

		// Mistral supports prompt_cache_key natively. Drop only OpenAI-specific
		// controls that are absent from Mistral's Chat Completion schema.
		// Drop these proactively so /responses-surface requests convert cleanly to chat.
		for (const key of MISTRAL_UNSUPPORTED_CHAT_FIELDS) {
			delete request[key];
		}
	},
};
