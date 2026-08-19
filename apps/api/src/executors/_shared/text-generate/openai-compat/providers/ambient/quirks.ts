// Purpose: Preserve Ambient's documented request extensions through the shared IR bridge.
// Why: These controls have no provider-neutral IR equivalent and would otherwise be dropped.
// How: Copies only the extension fields published in Ambient's OpenAPI schema.

import type { ProviderQuirks } from "../../quirks/types";

const AMBIENT_EXTENSION_FIELDS = [
	"thinking_budget",
	"emit_usage",
	"emit_verified",
	"emit_ambient_events",
	"wait_for_verification",
	"enabled_tools",
	"force_auction_v2",
	"guided_json",
] as const;

export const ambientQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir }) => {
		const raw = ir.rawRequest;
		if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;

		for (const field of AMBIENT_EXTENSION_FIELDS) {
			if (raw[field] !== undefined) request[field] = raw[field];
		}
	},
};
