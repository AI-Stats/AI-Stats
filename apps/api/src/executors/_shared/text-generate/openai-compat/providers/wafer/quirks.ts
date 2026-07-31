// Purpose: Shared OpenAI-compatible text adapter transformations for Wafer.
// Why: Phaseo service tiers select Wafer's provider-model sibling and are not upstream parameters.
// How: Removes service_tier after gateway routing has selected Kimi-K3 or Kimi-K3-Fast.

import type { ProviderQuirks } from "../../quirks/types";

export const waferQuirks: ProviderQuirks = {
	transformRequest: ({ request }) => {
		if (!request || typeof request !== "object") return;
		delete request.service_tier;
	},
};
