import type { Metadata } from "next";
import { Suspense } from "react";
import ProviderCompareDashboard from "@/components/(data)/api-providers/ProviderCompareDashboard";
import { fetchFrontendAPIProviders } from "@/lib/fetchers/frontend/fetchPublicCatalog";
import type { APIProviderCard } from "@/lib/fetchers/api-providers/providerDataTypes";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({ title: "Compare Providers", description: "Compare AI gateway providers by model coverage, modalities, location, and recent usage.", path: "/api-providers/compare" });

async function ProviderCompareContent() {
	const providers = await fetchFrontendAPIProviders() as APIProviderCard[];
	return <ProviderCompareDashboard providers={providers} />;
}

export default function ProviderComparePage() {
	return <Suspense fallback={<div className="mx-auto w-full max-w-7xl px-4 py-10"><div className="h-9 w-64 animate-pulse rounded-md bg-muted/50" /><div className="mt-6 h-40 animate-pulse rounded-xl bg-muted/30" /></div>}><ProviderCompareContent /></Suspense>;
}
