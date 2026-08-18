export const MODEL_CATALOGUE_SWR_OPTIONS = {
	dedupingInterval: 15 * 60 * 1_000,
	refreshInterval: 15 * 60 * 1_000,
	revalidateIfStale: false,
	revalidateOnFocus: true,
	focusThrottleInterval: 15 * 60 * 1_000,
} as const;

export function modelCatalogueRevalidationPath(path: string): string {
	const url = new URL(path, "https://phaseo.local");
	url.searchParams.set("revalidate", "1");
	return `${url.pathname}${url.search}`;
}
