// Purpose: Shared OpenAI-compatible text adapter and transformations.
// Why: Consolidates OpenAI-style quirks across many providers.
// How: Maps IR to OpenAI formats and normalizes streaming events.

import type { ProviderQuirks } from "../../quirks/types";

function resolveReasoningEffort(reasoning: any): string | undefined {
	if (!reasoning || typeof reasoning !== "object") return undefined;
	if (typeof reasoning.effort === "string" && reasoning.effort.length > 0) {
		return reasoning.effort;
	}
	if (reasoning.enabled === false) return "none";
	if (reasoning.enabled === true) return "medium";
	return undefined;
}

export const inceptionQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir }) => {
		if (!request || typeof request !== "object") return;

		const effort = resolveReasoningEffort(ir?.reasoning);
		if (request.reasoning_effort == null && typeof effort === "string") {
			request.reasoning_effort = effort;
		}

		const inceptionVendor = (ir?.vendor as any)?.inception;
		if (inceptionVendor && typeof inceptionVendor === "object") {
			if (request.reasoning_summary == null && typeof inceptionVendor.reasoning_summary === "boolean") {
				request.reasoning_summary = inceptionVendor.reasoning_summary;
			} else if (request.reasoning_summary == null && typeof ir?.reasoning?.summary === "string") {
				request.reasoning_summary = true;
			}
			if (
				request.reasoning_summary_wait == null &&
				(
					typeof inceptionVendor.reasoning_summary_wait === "boolean" ||
					typeof inceptionVendor.reasoning_summary_wait === "number"
				)
			) {
				request.reasoning_summary_wait = inceptionVendor.reasoning_summary_wait;
			}
			if (request.diffusing == null && typeof inceptionVendor.diffusing === "boolean") {
				request.diffusing = inceptionVendor.diffusing;
			}
			if (request.realtime == null && typeof inceptionVendor.realtime === "boolean") {
				request.realtime = inceptionVendor.realtime;
			}
		}

		if ("reasoning" in request) {
			delete request.reasoning;
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

	transformStreamChunk: ({ chunk }) => {
		const summary = chunk?.reasoning_summary?.content;
		if (typeof summary !== "string" || summary.length === 0) return;
		const firstChoice = Array.isArray(chunk.choices) ? chunk.choices[0] : undefined;
		if (firstChoice) {
			firstChoice.delta ??= {};
			firstChoice.delta.reasoning_content ??= summary;
		}
	},

	normalizeResponse: ({ response }) => {
		const summary = response?.reasoning_summary?.content;
		if (typeof summary !== "string" || summary.length === 0) return;
		const firstChoice = Array.isArray(response.choices) ? response.choices[0] : undefined;
		if (firstChoice) {
			firstChoice.message ??= {};
			firstChoice.message.reasoning_content ??= summary;
		}
	},
};
