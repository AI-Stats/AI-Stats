// Purpose: Friendli OpenAI-compatible request normalization.
// Why: Friendli Chat documents system/user/assistant/tool roles, while the gateway also accepts developer.
// How: Rewrites developer messages without changing the remaining OpenAI-compatible payload.

import type { ProviderQuirks } from "../../quirks/types";

export const friendliQuirks: ProviderQuirks = {
	transformRequest: ({ request }) => {
		if (!Array.isArray(request.messages)) return;
		request.messages = request.messages.map((message: any) =>
			message?.role === "developer"
				? { ...message, role: "system" }
				: message,
		);
	},
};
