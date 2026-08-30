import { describe, expect, it } from "vitest";
import { selectPricingRouteRows } from "./loader";

describe("selectPricingRouteRows", () => {
	it("keeps an executed provider-model route isolated from canonical siblings", () => {
		const exact = [{ provider_model_id: "minimax:hd", provider_model_slug: "minimax/speech-2.8-hd" }];
		const canonical = [
			...exact,
			{ provider_model_id: "minimax:turbo", provider_model_slug: "minimax/speech-2.8-turbo" },
		];

		expect(selectPricingRouteRows(exact, canonical, [])).toEqual(exact);
	});

	it("deduplicates legacy canonical and provider-slug matches", () => {
		const route = { provider_model_id: "minimax:hd", provider_model_slug: "minimax/speech-2.8-hd" };
		expect(selectPricingRouteRows([], [route], [route])).toEqual([route]);
	});
});
