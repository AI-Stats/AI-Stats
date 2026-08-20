import type { APIProviderCard } from "@/lib/fetchers/api-providers/providerDataTypes";

export type ProviderCoverageFilter = "active" | "free" | "inactive";

export function matchesProviderCoverage(
	provider: APIProviderCard,
	filter: string,
): boolean {
	switch (filter as ProviderCoverageFilter) {
		case "active":
			return provider.is_gateway_provider;
		case "free":
			return provider.free_models > 0;
		case "inactive":
			return !provider.is_gateway_provider && provider.active_models === 0;
		default:
			return false;
	}
}
