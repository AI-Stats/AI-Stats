// Purpose: Shared OpenAI-compatible text adapter and transformations.
// Why: Consolidates OpenAI-style quirks across many providers.
// How: Maps IR to OpenAI formats and normalizes streaming events.

import type { ProviderQuirks } from "../../quirks/types";

function toPerplexityReasoningEffort(value: string): "minimal" | "low" | "medium" | "high" | null {
	const normalized = value.toLowerCase();
	if (normalized === "xlow" || normalized === "minimal") return "minimal";
	if (normalized === "low") return "low";
	if (normalized === "medium") return "medium";
	if (normalized === "high" || normalized === "xhigh") return "high";
	if (normalized === "none") return null;
	return null;
}

export const perplexityQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir }) => {
		if (!request || typeof request !== "object") return;

		// Perplexity chat role enum does not include OpenAI's "developer" role.
		// Normalize to "system" before dispatch.
		if (Array.isArray(request.messages)) {
			request.messages = request.messages.map((msg: any) => {
				let content = msg?.content;
				if (Array.isArray(content)) {
					if (content.some((part: any) => part?.type !== "text" || typeof part?.text !== "string")) {
						throw new Error("perplexity_sonar_multimodal_input_unsupported");
					}
					content = content.map((part: any) => part.text).join("");
				}
				return {
					...msg,
					...(msg?.role === "developer" ? { role: "system" } : {}),
					content,
				};
			});
		}

		// Perplexity uses top-level reasoning_effort for reasoning controls.
		if (request.reasoning_effort == null) {
			const effort = ir?.reasoning?.effort;
			if (typeof effort === "string") {
				const mapped = toPerplexityReasoningEffort(effort);
				if (mapped) request.reasoning_effort = mapped;
			} else if (ir?.reasoning?.enabled === true) {
				request.reasoning_effort = "medium";
			}
		}

		// Sonar keeps location/context controls nested, while its search filters
		// are top-level request fields. Public protocols expose a single
		// web_search_options object, so split it into the provider's wire shape.
		if (request.web_search_options && typeof request.web_search_options === "object") {
			const options = { ...request.web_search_options };
			const topLevelSearchFields = [
				"search_mode",
				"search_type",
				"return_images",
				"return_related_questions",
				"enable_search_classifier",
				"disable_search",
				"search_domain_filter",
				"search_language_filter",
				"search_recency_filter",
				"search_after_date_filter",
				"search_before_date_filter",
				"last_updated_after_filter",
				"last_updated_before_filter",
				"image_domain_filter",
				"image_format_filter",
				"stream_mode",
				"language_preference",
			];
			for (const field of topLevelSearchFields) {
				if (options[field] !== undefined && request[field] === undefined) {
					request[field] = options[field];
				}
				delete options[field];
			}
			if (Object.keys(options).length > 0) request.web_search_options = options;
			else delete request.web_search_options;
		}
	},

	extractReasoning: ({ choice, rawContent }) => {
		const reasoningContent = choice?.message?.reasoning_content;
		return {
			main: rawContent,
			reasoning:
				typeof reasoningContent === "string" && reasoningContent.length > 0
					? [reasoningContent]
					: [],
		};
	},
};
