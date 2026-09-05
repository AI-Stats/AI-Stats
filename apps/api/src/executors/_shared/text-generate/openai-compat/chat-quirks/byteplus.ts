import type { ChatQuirk } from "./types";
import { applyBytePlusRequestQuirks } from "../providers/byteplus/quirks";

export const bytePlusChatQuirk: ChatQuirk = {
	id: "byteplus",
	matches: (providerId) => providerId === "byteplus",
	onRequest: ({ ir, request }) => applyBytePlusRequestQuirks(request, ir),
	onResponse: ({ choice, rawContent }) => {
		const reasoning = choice?.message?.reasoning_content;
		return {
			main: rawContent,
			reasoning: typeof reasoning === "string" && reasoning.length > 0 ? [reasoning] : [],
		};
	},
};
