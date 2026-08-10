export const BYOK_KEYS_PER_PROVIDER_LIMIT = 32;

export function isByokKeyEligible(args: {
	allowedModelSlugs?: unknown;
	allowedApiKeyIds?: unknown;
	requestedModel: string;
	apiKeyId: string;
}): boolean {
	const allowedModels = Array.isArray(args.allowedModelSlugs) ? args.allowedModelSlugs.map(String) : [];
	const allowedApiKeyIds = Array.isArray(args.allowedApiKeyIds) ? args.allowedApiKeyIds.map(String) : [];
	return (allowedModels.length === 0 || allowedModels.includes(args.requestedModel))
		&& (allowedApiKeyIds.length === 0 || allowedApiKeyIds.includes(args.apiKeyId));
}
