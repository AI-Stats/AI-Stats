import { readBindingEnv } from "./helpers";

export type CatalogSyncDispatchSummary = {
	dispatched: boolean;
	skipped: boolean;
	providers: string[];
	reason?: string | null;
};

const DEFAULT_GITHUB_API_URL = "https://api.github.com";
const DEFAULT_GITHUB_REPOSITORY = "phaseoteam/Phaseo";

export async function dispatchProviderCatalogSync(
	providerIds: string[],
	request: typeof fetch = fetch,
): Promise<CatalogSyncDispatchSummary> {
	const providers = [...new Set(providerIds.map((value) => value.trim().toLowerCase()).filter(Boolean))].sort();
	if (providers.length === 0) {
		return { dispatched: false, skipped: true, providers, reason: "no provider changes" };
	}
	const token = readBindingEnv(["GITHUB_TOKEN", "GH_TOKEN"]);
	if (!token) {
		return { dispatched: false, skipped: true, providers, reason: "missing GITHUB_TOKEN/GH_TOKEN" };
	}
	const repository = readBindingEnv(["GITHUB_REPOSITORY"]) ?? DEFAULT_GITHUB_REPOSITORY;
	const apiUrl = (readBindingEnv(["GITHUB_API_URL"]) ?? DEFAULT_GITHUB_API_URL).replace(/\/$/, "");
	const response = await request(`${apiUrl}/repos/${repository}/dispatches`, {
		method: "POST",
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			"User-Agent": "phaseo-gateway-model-discovery",
			"X-GitHub-Api-Version": "2022-11-28",
		},
		body: JSON.stringify({
			event_type: "provider-catalog-change",
			client_payload: { providers },
		}),
		signal: AbortSignal.timeout(30_000),
	});
	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(`GitHub repository dispatch failed with HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`);
	}
	return { dispatched: true, skipped: false, providers };
}
