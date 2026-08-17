import { WebApiError } from "@/lib/web-api/client";

export async function accountSWRFetcher<T>(path: string): Promise<T> {
	const response = await fetch(path, {
		headers: { Accept: "application/json" },
		credentials: "same-origin",
		cache: "no-store",
	});

	if (!response.ok) {
		throw new WebApiError(path, response.status);
	}

	return (await response.json()) as T;
}
