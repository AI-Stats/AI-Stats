"use cache";

import { cacheLife, cacheTag } from "next/cache";

import {
	CachedPublicWebApiError,
	PUBLIC_DATA_CACHE_LIFE,
	publicDataCacheTags,
} from "./publicDataCache";

export type CachedPublicWebApiResponse = {
	body: string;
};

/**
 * Share expensive public catalogue and rankings responses across users and
 * Vercel renders. Browser requests remain owned by SWR, while Cloudflare keeps
 * caching direct API traffic at the edge.
 */
export async function fetchCachedPublicWebApi(
	origin: string,
	path: string,
): Promise<CachedPublicWebApiResponse> {
	const tags = publicDataCacheTags(path);
	if (!tags) throw new Error(`Unsupported public data cache path: ${path}`);

	cacheLife(PUBLIC_DATA_CACHE_LIFE);
	cacheTag(...tags);

	const response = await fetch(`${origin}${path}`, {
		headers: { Accept: "application/json" },
		cache: "no-store",
	});
	if (!response.ok) throw new CachedPublicWebApiError(path, response.status);

	return {
		body: await response.text(),
	};
}
