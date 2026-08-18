import {
	MODEL_CATALOGUE_SWR_OPTIONS,
	modelCatalogueRevalidationPath,
} from "@/lib/swr/catalogueCache";

describe("model catalogue SWR policy", () => {
	it("refreshes every fifteen minutes and throttles focus revalidation", () => {
		expect(MODEL_CATALOGUE_SWR_OPTIONS).toEqual({
			dedupingInterval: 15 * 60 * 1_000,
			refreshInterval: 15 * 60 * 1_000,
			revalidateIfStale: false,
			revalidateOnFocus: true,
			focusThrottleInterval: 15 * 60 * 1_000,
		});
	});

	it("adds the explicit uncached revalidation signal without changing the SWR key", () => {
		expect(modelCatalogueRevalidationPath("/api/_web/models?shape=table"))
			.toBe("/api/_web/models?shape=table&revalidate=1");
	});
});
