function text(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeBatchEndpoint(endpoint: unknown): string {
	const path = text(endpoint)?.replace(/^https?:\/\/[^/]+/i, "").split(/[?#]/, 1)[0] ?? "/v1/responses";
	const normalized = `/${path.replace(/^\/+/, "").replace(/\/+$/, "")}`.toLowerCase();
	return normalized.startsWith("/v1/") ? normalized : `/v1${normalized}`;
}
