export const STEALTH_PROVIDER_ID = "stealth";
export const STEALTH_PROVIDER_DISPLAY_NAME = "Stealth";

export function publicProviderDisplayName(providerId: unknown, providerName: unknown): string {
	const id = String(providerId ?? "").trim();
	const name = String(providerName ?? "").trim();
	if (id.toLowerCase() === STEALTH_PROVIDER_ID || name.toLowerCase() === STEALTH_PROVIDER_ID) {
		return STEALTH_PROVIDER_DISPLAY_NAME;
	}
	return name || id;
}

export function publicProviderPayload<T>(value: T): T {
	if (Array.isArray(value)) return value.map((item) => publicProviderPayload(item)) as T;
	if (!value || typeof value !== "object") return value;

	const record = Object.fromEntries(
		Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, publicProviderPayload(item)]),
	) as Record<string, unknown>;
	const providerId = String(
		record.api_provider_id ?? record.provider_id ?? record.provider_slug ?? record.id ?? "",
	).trim().toLowerCase();
	if (providerId !== STEALTH_PROVIDER_ID) return record as T;

	for (const key of ["api_provider_name", "provider_name", "name"] as const) {
		if (key in record) record[key] = STEALTH_PROVIDER_DISPLAY_NAME;
	}
	return record as T;
}
