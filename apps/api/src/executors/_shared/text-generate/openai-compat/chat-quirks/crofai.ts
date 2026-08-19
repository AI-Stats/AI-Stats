import type { ChatQuirk } from "./types";

export const crofAIChatQuirk: ChatQuirk = {
	id: "crofai",
	matches: (providerId) => providerId === "crofai",
	onRequest: ({ request }) => {
		// Phaseo service tiers select the corresponding CrofAI route/model;
		// CrofAI's public Chat request example does not expose this field.
		delete request.service_tier;
	},
	onResponse: ({ choice, rawContent }) => {
		const reasoning = choice?.message?.reasoning_content;
		return {
			main: rawContent,
			reasoning: typeof reasoning === "string" && reasoning.length > 0 ? [reasoning] : [],
		};
	},
};
