import {
	PUBLIC_DATA_CACHE_LIFE,
	publicDataCacheTags,
} from "./publicDataCache";

describe("publicDataCacheTags", () => {
	it("caches catalogue and rankings requests with their invalidation tags", () => {
		expect(publicDataCacheTags("/api/_web/models?limit=2000")).toEqual(
			expect.arrayContaining(["public-model-catalogue", "frontend:models"]),
		);
		expect(publicDataCacheTags("/api/_web/rankings/models?time_range=week")).toEqual(
			expect.arrayContaining(["public-rankings", "frontend:rankings"]),
		);
	});

	it("leaves volatile and authenticated API families uncached", () => {
		expect(publicDataCacheTags("/api/_web/status")).toBeNull();
		expect(publicDataCacheTags("/api/account/settings")).toBeNull();
	});

	it("restores the proven Supabase-era cache lifetime", () => {
		expect(PUBLIC_DATA_CACHE_LIFE).toEqual({
			stale: 60 * 60,
			revalidate: 6 * 60 * 60,
			expire: 7 * 24 * 60 * 60,
		});
	});
});
