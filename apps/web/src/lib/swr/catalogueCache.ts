export const MODEL_CATALOGUE_SWR_OPTIONS = {
	dedupingInterval: 15 * 60 * 1_000,
	refreshInterval: 15 * 60 * 1_000,
	revalidateIfStale: false,
	revalidateOnFocus: false,
} as const;
