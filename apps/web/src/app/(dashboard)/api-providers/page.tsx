import type { Metadata } from "next";
import { Suspense } from "react";
import type { APIProviderCard } from "@/lib/fetchers/api-providers/providerDataTypes";
import { fetchFrontendAPIProviders } from "@/lib/fetchers/frontend/fetchPublicCatalog";
import APIProvidersDisplay from "@/components/(data)/api-providers/APIProvidersDisplay";
import { APIProvidersPageSkeleton } from "@/components/(data)/api-providers/APIProvidersPageSkeleton";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
	title: "Providers",
	description:
		"Compare AI API providers by pricing, model coverage, latency signals, BYOK support and gateway capabilities.",
	path: "/api-providers",
	keywords: [
		"AI API providers",
		"AI provider pricing",
		"LLM API providers",
		"BYOK AI providers",
		"AI gateway providers",
	],
});

async function APIProvidersSection() {
	const apiProviders =
		(await fetchFrontendAPIProviders()) as APIProviderCard[];

	return <APIProvidersDisplay providers={apiProviders} />;
}

function APIProvidersFallback() {
	return <APIProvidersPageSkeleton />;
}

export default function Page() {
	return (
		<main className="flex min-h-0 flex-1 flex-col">
			<Suspense fallback={<APIProvidersFallback />}>
				<APIProvidersSection />
			</Suspense>
		</main>
	);
}
