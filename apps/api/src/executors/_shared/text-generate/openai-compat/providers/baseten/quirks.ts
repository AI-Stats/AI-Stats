// Purpose: Shared OpenAI-compatible text adapter and transformations.
// Why: Consolidates OpenAI-style quirks across many providers.
// How: Maps IR to OpenAI formats and normalizes streaming events.

import type { ProviderQuirks } from "../../quirks/types";

function resolveReasoningEnabled(reasoning: any): boolean | undefined {
	if (!reasoning || typeof reasoning !== "object") return undefined;
	if (typeof reasoning.enabled === "boolean") return reasoning.enabled;
	if (typeof reasoning.effort === "string") {
		return reasoning.effort !== "none";
	}
	return undefined;
}

export const basetenQuirks: ProviderQuirks = {
	extractReasoning: ({ choice, rawContent }) => {
		const reasoning = choice?.message?.reasoning_content;
		return {
			main: rawContent,
			reasoning: typeof reasoning === "string" && reasoning.length > 0 ? [reasoning] : [],
		};
	},
	transformRequest: ({ request, ir }) => {
		// Phaseo uses this field to select Baseten's dedicated Fast model slug.
		// Baseten does not accept service_tier as an upstream request parameter.
		delete request.service_tier;

		for (const message of Array.isArray(request.messages) ? request.messages : []) {
			if (!Array.isArray(message?.content)) continue;
			message.content = message.content.map((part: any) => {
				if (part?.type === "input_audio" && part.input_audio) {
					const audio = part.input_audio;
					const url = typeof audio.url === "string"
						? audio.url
						: typeof audio.data === "string"
							? `data:audio/${audio.format || "wav"};base64,${audio.data}`
							: undefined;
					return url ? { type: "audio_url", audio_url: { url } } : part;
				}
				if (part?.type === "input_video" && part.video_url) {
					return { type: "video_url", video_url: part.video_url };
				}
				return part;
			});
		}

		const enabled = resolveReasoningEnabled(ir.reasoning);
		if (typeof ir.reasoning?.effort === "string") {
			request.reasoning_effort = ir.reasoning.effort;
		}
		if (typeof enabled !== "boolean") return;

		request.chat_template_args = {
			...(request.chat_template_args && typeof request.chat_template_args === "object"
				? request.chat_template_args
				: {}),
			enable_thinking: enabled,
		};
	},
};
