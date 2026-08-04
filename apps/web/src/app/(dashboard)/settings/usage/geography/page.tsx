import { redirect } from "next/navigation";
import { GeographyUsage } from "@/components/(gateway)/usage/GeographyUsage";
import { fetchSettingsGeography } from "@/lib/fetchers/internal/fetchSettingsGeography";

export default async function UsageGeographyPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const params = await searchParams;
	const result = await fetchSettingsGeography(params);
	if (!result?.signedIn) redirect("/sign-in");

	const rows = (result.data ?? []).map((row) => ({
		countryCode: row.country_code,
		requests: Number(row.requests ?? 0),
		tokens: Number(row.tokens ?? 0),
		spendNanos: Number(row.spend_nanos ?? 0),
		successes: Number(row.successes ?? 0),
		averageLatencyMs: row.average_latency_ms == null ? null : Number(row.average_latency_ms),
	}));

	return (
		<section className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Geography</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Country-level usage for this workspace, inferred by Cloudflare without storing raw IP addresses.
				</p>
			</div>
			<GeographyUsage rows={rows} />
		</section>
	);
}
