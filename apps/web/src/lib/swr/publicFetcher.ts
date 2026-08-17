import { WebApiError } from "@/lib/web-api/client";

export async function publicSWRFetcher<T>(path: string): Promise<T> {
	const response = await fetch(path, {
		headers: { Accept: "application/json" },
		// Deployment-protected previews require Vercel's same-origin auth
		// cookie. The local API proxy forwards only the Accept header, so app
		// session cookies are not exposed to the public Worker.
		credentials: "same-origin",
	});

	if (!response.ok) {
		throw new WebApiError(path, response.status);
	}

	return (await response.json()) as T;
}
