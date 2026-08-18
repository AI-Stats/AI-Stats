import { MODEL_CATALOGUE_SWR_OPTIONS } from "@/lib/swr/catalogueCache";

describe("model catalogue SWR policy", () => {
	it("shares entries for fifteen minutes without focus or remount revalidation", () => {
		expect(MODEL_CATALOGUE_SWR_OPTIONS).toEqual({
			dedupingInterval: 15 * 60 * 1_000,
			refreshInterval: 15 * 60 * 1_000,
			revalidateIfStale: false,
			revalidateOnFocus: false,
		});
	});
});
