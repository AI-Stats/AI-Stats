import { GeographyUsage } from "@/components/(gateway)/usage/GeographyUsage";
import { fetchFrontendRankingGeography } from "@/lib/fetchers/frontend/fetchPublicCatalog";

export async function PublicGeography() {
	const result = await fetchFrontendRankingGeography(30).catch(() => ({ data: [], days: 30 }));
	const rows = (result.data ?? []).map((row) => ({
		countryCode: row.country_code,
		requests: Number(row.requests ?? 0),
		tokens: Number(row.tokens ?? 0),
		sharePercent: Number(row.share_percent ?? 0),
	}));

	return (
		<section id="geography" className="mx-auto max-w-[1680px] space-y-4 px-4 pb-16 sm:px-6 lg:px-10">
			<div className="border-t pt-12">
				<h2 className="text-2xl font-semibold leading-8">Usage by country</h2>
				<p className="mt-1 max-w-3xl text-sm text-muted-foreground">
					Where Phaseo gateway traffic originated over the last 30 days. Countries only appear after meeting minimum request and workspace thresholds; smaller cohorts are grouped as Other.
				</p>
			</div>
			<GeographyUsage rows={rows} publicView />
		</section>
	);
}
