export const PUBLIC_DATA_CACHE_LIFE = {
	stale: 60 * 60,
	revalidate: 6 * 60 * 60,
	expire: 7 * 24 * 60 * 60,
} as const;

export class CachedPublicWebApiError extends Error {
	readonly status: number;

	constructor(path: string, status: number) {
		super(`Public web API request failed (${status}): ${path}`);
		this.name = "CachedPublicWebApiError";
		this.status = status;
	}
}

export function publicDataCacheTags(path: string): string[] | null {
	if (path.startsWith("/api/_web/rankings")) {
		return ["public-rankings", "frontend:rankings", "web-api-rankings"];
	}
	if (path.startsWith("/api/_web/models")) {
		return [
			"public-model-catalogue",
			"frontend:models",
			"web-api-models",
			"web-api-models-v2",
		];
	}
	return null;
}
