// Purpose: Preserve Darkbloom sampling controls that extend the OpenAI Responses shape.
// Why: Darkbloom's live catalog advertises top_k and repetition_penalty, which have IR
// equivalents but are not fields in OpenAI's native Responses contract.

import type { ProviderQuirks } from "../../quirks/types";

export const darkbloomQuirks: ProviderQuirks = {
	transformRequest: ({ request, ir }) => {
		if (ir.topK !== undefined) request.top_k = ir.topK;
		if (ir.repetitionPenalty !== undefined) {
			request.repetition_penalty = ir.repetitionPenalty;
		}
	},
};
