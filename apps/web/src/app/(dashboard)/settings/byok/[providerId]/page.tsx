import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Logo } from "@/components/Logo";
import ByokProviderKeys, { type ByokKeyEntry } from "@/components/(gateway)/settings/byok/ByokProviderKeys";
import { fetchFrontendAPIProviders } from "@/lib/fetchers/frontend/fetchPublicCatalog";
import { fetchSettingsByokInitialData } from "@/lib/fetchers/internal/fetchSettingsByokInitialData";

export const metadata = { title: "Provider Keys - BYOK Settings" };

export default async function ByokProviderPage({ params }: { params: Promise<{ providerId: string }> }) {
	const { providerId: encodedProviderId } = await params;
	const providerId = decodeURIComponent(encodedProviderId);
	const [initialData, providerCatalog] = await Promise.all([
		fetchSettingsByokInitialData(),
		fetchFrontendAPIProviders(),
	]);
	const catalogProvider = providerCatalog.find((candidate) => String(candidate.api_provider_id ?? "") === providerId);
	const providerEntries = initialData.keyEntries.filter((entry) => entry.providerId === providerId) as ByokKeyEntry[];
	if (!catalogProvider && providerEntries.length === 0) notFound();

	const provider = {
		id: providerId,
		name: String(catalogProvider?.api_provider_name ?? providerId),
		logoId: providerId,
	};

	return (
		<div className="mx-auto space-y-8">
			<div>
				<nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
					<Link href="/settings/byok" className="inline-flex items-center gap-1.5 hover:text-foreground">
						<ArrowLeft className="h-4 w-4" />
						BYOK
					</Link>
					<span aria-hidden="true">/</span>
					<span className="text-foreground">{provider.name}</span>
				</nav>
				<div className="mt-5 flex items-start gap-3">
					<Logo id={provider.logoId} alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">{provider.name}</h1>
						<Link href={`/api-providers/${encodeURIComponent(provider.id)}`} className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4">
							View supported models
							<ExternalLink className="h-3.5 w-3.5" />
						</Link>
					</div>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
				<div>
					<h2 className="text-sm font-semibold">Provider Keys</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Add and configure API keys. Keys are attempted deterministically in the order shown.
					</p>
				</div>
				<ByokProviderKeys provider={provider} entries={providerEntries} />
			</div>
		</div>
	);
}
