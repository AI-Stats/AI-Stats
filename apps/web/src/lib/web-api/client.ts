const DEFAULT_WEB_API_ORIGIN = "https://phaseo.app";

export class WebApiError extends Error {
	readonly status: number;
	readonly detail?: string;

	constructor(path: string, status: number, detail?: string) {
		super(detail || `Cloudflare web API request failed (${status}): ${path}`);
		this.name = "WebApiError";
		this.status = status;
		this.detail = detail;
	}
}

function getWebApiOrigin(): string {
	if (typeof window !== "undefined") return "";
	return (process.env.WEB_API_ORIGIN ?? DEFAULT_WEB_API_ORIGIN).replace(/\/+$/, "");
}

async function serverCookieHeader(): Promise<string | null> {
	if (typeof window !== "undefined") return null;
	try {
		const { cookies } = await import("next/headers");
		const values = (await cookies()).getAll();
		return values.length
			? values.map(({ name, value }) => `${name}=${value}`).join("; ")
			: null;
	} catch {
		return null;
	}
}

async function readJsonPayload<T>(
	response: Response,
	path: string,
): Promise<
	(T & { error?: unknown; message?: unknown; detail?: unknown }) | undefined
> {
	const body = await response.text();
	if (!body.trim()) return undefined;

	try {
		return JSON.parse(body) as T & {
			error?: unknown;
			message?: unknown;
			detail?: unknown;
		};
	} catch {
		throw new WebApiError(
			path,
			response.status,
			`Expected a JSON response but received ${response.headers.get("content-type") || "an unknown content type"}.`,
		);
	}
}

/**
 * Fetch public website data from the Cloudflare Worker.
 *
 * Next's data cache is deliberately disabled here. Public freshness, stale
 * serving, cache tags, and revalidation are owned by Cloudflare so there is a
 * single cache contract for every web deployment.
 */
export async function fetchPublicWebApi<T>(path: `/api/_web/${string}`): Promise<T> {
	const response = await fetch(`${getWebApiOrigin()}${path}`, {
		headers: { Accept: "application/json" },
		cache: "no-store",
	});

	if (!response.ok) {
		throw new WebApiError(path, response.status);
	}

	return (await response.json()) as T;
}

export async function fetchOptionalPublicWebApi<T>(
	path: `/api/_web/${string}`,
): Promise<T | null> {
	try {
		return await fetchPublicWebApi<T>(path);
	} catch (error) {
		if (error instanceof WebApiError && error.status === 404) return null;
		throw error;
	}
}

export async function fetchAccountWebApi<T>(
	path: `/api/account/${string}`,
	accessToken?: string | null,
	init: RequestInit = {},
): Promise<T> {
	const cookie = accessToken ? null : await serverCookieHeader();
	const response = await fetch(`${getWebApiOrigin()}${path}`, {
		...init,
		headers: {
			Accept: "application/json",
			...(init.body ? { "Content-Type": "application/json" } : {}),
			...init.headers,
			...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			...(cookie ? { Cookie: cookie } : {}),
		},
		cache: "no-store",
	});
	const payload = await readJsonPayload<T>(response, path);
	if (!response.ok) {
		throw new WebApiError(
			path,
			response.status,
			typeof payload?.message === "string"
				? payload.message
				: typeof payload?.detail === "string"
					? payload.detail
					: typeof payload?.error === "string" ? payload.error : undefined,
		);
	}
	return payload as T;
}

export async function fetchInternalWebApi<T>(
	path: `/api/internal/${string}`,
	accessToken: string | null,
	init: RequestInit = {},
): Promise<T> {
	const cookie = accessToken ? null : await serverCookieHeader();
	const response = await fetch(`${getWebApiOrigin()}${path}`, {
		...init,
		headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(cookie ? { Cookie: cookie } : {}) },
		cache: "no-store",
	});
	const payload = await readJsonPayload<T>(response, path);
	if (!response.ok) throw new WebApiError(path, response.status, typeof payload?.error === "string" ? payload.error : undefined);
	return payload as T;
}

export async function fetchInternalWebApiResponse(
	path: `/api/internal/${string}`,
	accessToken: string | null,
	init: RequestInit = {},
): Promise<Response> {
	const cookie = accessToken ? null : await serverCookieHeader();
	return fetch(`${getWebApiOrigin()}${path}`, {
		...init,
		headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(cookie ? { Cookie: cookie } : {}) },
		cache: "no-store",
	});
}

/** Authenticated, private chat proxy request owned by the Cloudflare Worker. */
export async function fetchChatWebApi(path: `/api/chat/${string}`, init: RequestInit = {}): Promise<Response> {
	const { getBrowserAccessToken } = await import("@/lib/fetchers/internal/accountAuthClient");
	const accessToken = await getBrowserAccessToken();
	return fetch(path, {
		...init,
		headers: { ...init.headers, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
		cache: "no-store",
		credentials: "same-origin",
	});
}
