import type { ProviderQuirks } from "../../quirks/types";

function isKimi26Family(model: unknown): boolean {
	const value = String(model ?? "").toLowerCase();
	return value.includes("kimi-k2.6") || value.includes("kimi-k2.7-code");
}

export const cloudflareQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir, model }) => {
		if (!isKimi26Family(model ?? ir.model) || !ir.reasoning) return;
		const thinking = ir.reasoning.effort === "none" || ir.reasoning.enabled === false
			? false
			: ir.reasoning.effort ?? ir.reasoning.enabled;
		if (thinking === undefined) return;
		request.chat_template_kwargs = {
			...(request.chat_template_kwargs && typeof request.chat_template_kwargs === "object"
				? request.chat_template_kwargs
				: {}),
			thinking,
		};
	},
	transformStreamChunk: ({ chunk }) => {
		for (const choice of Array.isArray(chunk?.choices) ? chunk.choices : []) {
			if (typeof choice?.delta?.reasoning === "string" && choice.delta.reasoning_content == null) {
				choice.delta.reasoning_content = choice.delta.reasoning;
			}
		}
	},
	extractReasoning: ({ choice, rawContent }) => {
		const reasoning = choice?.message?.reasoning ?? choice?.message?.reasoning_content;
		return {
			main: rawContent,
			reasoning: typeof reasoning === "string" && reasoning.length > 0 ? [reasoning] : [],
		};
	},
};
