import type { GatewayContextData } from "./types";

const NEBIUS_REGIONAL_MODEL_ALLOWLIST: Record<string, readonly string[]> = {
	"nebius-token-factory-eu-north-1": [
		"google/gemma-3-27b",
		"google/gemma-3-27b-it",
		"meta/llama-3.3-70b",
		"meta-llama/llama-3.3-70b-instruct",
		"nousresearch/hermes-4-405b",
		"nousresearch/hermes-4-70b",
		"nvidia/cosmos3-super-reasoner",
		"nvidia/llama-3.1-nemotron-ultra-253b",
		"nvidia/llama-3_1-nemotron-ultra-253b-v1",
		"nvidia/nvidia-nemotron-3-nano-30b-a3b",
		"nvidia/nemotron-3-nano-omni",
		"openai/gpt-oss-120b",
		"openbmb/minicpm-v-4_5",
		"qwen/qwen2.5-vl-72b",
		"qwen/qwen2.5-vl-72b-instruct",
		"qwen/qwen3-235b-a22b-2507",
		"qwen/qwen3-235b-a22b-instruct-2507",
		"qwen/qwen3-30b-a3b-2507",
		"qwen/qwen3-30b-a3b-instruct-2507",
		"qwen/qwen3-32b",
		"qwen/qwen3-next-80b-a3b-thinking",
		"z-ai/glm-5.1",
		"zai-org/glm-5.1",
	],
	"nebius-token-factory-us-central-1": [
		"deepseek/deepseek-v4-flash",
		"deepseek-ai/deepseek-v4-flash",
		"minimax/minimax-m2.5",
		"minimax/minimax-m3",
		"minimaxai/minimax-m2.5",
		"minimaxai/minimax-m3",
		"moonshotai/kimi-k2.6",
		"moonshotai/kimi-k2.7-code",
		"nvidia/nemotron-3-super-120b-a12b",
		"nvidia/nemotron-3-super-2026-03-11",
		"nvidia/nemotron-3-ultra-550b-a55b",
		"nvidia/nemotron-3.5-lightning",
		"nvidia/nemotron-3_5-lightning",
		"qwen/qwen3.5-397b-a17b",
		"z-ai/glm-5.3-flash",
		"zai-org/glm-5.3-flash",
	],
};

const NEBIUS_REGIONAL_MODEL_ALLOWLIST_SETS = Object.fromEntries(
	Object.entries(NEBIUS_REGIONAL_MODEL_ALLOWLIST).map(([providerId, modelIds]) => [
		providerId,
		new Set(modelIds.map((modelId) => String(modelId).trim().toLowerCase()).filter(Boolean)),
	]),
) as Record<string, Set<string>>;

export function splitProviderScopedModel(model: string): { providerId: string; providerModelSlug: string } | null {
	const value = String(model ?? "").trim();
	const slash = value.indexOf("/");
	if (slash <= 0 || slash === value.length - 1) return null;
	const providerId = value.slice(0, slash).trim().toLowerCase();
	const providerModelSlug = value.slice(slash + 1).trim();
	if (!providerId || !providerModelSlug) return null;
	return { providerId, providerModelSlug };
}

function normalizeModelId(value: string | null | undefined): string {
	return String(value ?? "").trim().toLowerCase();
}

function providerAllowsNebiusRegionalModel(args: {
	providerId: string;
	providerModelSlug: string | null;
	resolvedModel: string | null | undefined;
	requestedModel: string;
}): boolean {
	const allowlist = NEBIUS_REGIONAL_MODEL_ALLOWLIST_SETS[args.providerId];
	if (!allowlist) return true;

	const directSlug = normalizeModelId(args.providerModelSlug);
	if (directSlug && allowlist.has(directSlug)) return true;

	const resolvedModel = normalizeModelId(args.resolvedModel);
	if (resolvedModel && allowlist.has(resolvedModel)) return true;

	const requestedModel = normalizeModelId(args.requestedModel);
	if (requestedModel && allowlist.has(requestedModel)) return true;

	const requestedScoped = splitProviderScopedModel(args.requestedModel);
	if (requestedScoped && requestedScoped.providerId === args.providerId) {
		const scopedSlug = normalizeModelId(requestedScoped.providerModelSlug);
		if (scopedSlug && allowlist.has(scopedSlug)) return true;
	}

	const resolvedScoped = splitProviderScopedModel(String(args.resolvedModel ?? ""));
	if (resolvedScoped && resolvedScoped.providerId === args.providerId) {
		const scopedSlug = normalizeModelId(resolvedScoped.providerModelSlug);
		if (scopedSlug && allowlist.has(scopedSlug)) return true;
	}

	return false;
}

export function applyNebiusRegionalModelAllowlist(args: {
	parsed: GatewayContextData;
	requestedModel: string;
}): GatewayContextData {
	const parsed = args.parsed;
	const providers = Array.isArray(parsed.providers) ? parsed.providers : [];
	if (!providers.length) return parsed;

	let changed = false;
	const filteredProviders = providers.filter((provider) => {
		const allowed = providerAllowsNebiusRegionalModel({
			providerId: provider.providerId,
			providerModelSlug: provider.providerModelSlug,
			resolvedModel: parsed.resolvedModel,
			requestedModel: args.requestedModel,
		});
		if (!allowed) changed = true;
		return allowed;
	});

	if (!changed) return parsed;

	const allowedProviderIds = new Set(filteredProviders.map((provider) => provider.providerId));
	const filteredPricing = Object.fromEntries(
		Object.entries(parsed.pricing ?? {}).filter(([providerId]) =>
			allowedProviderIds.has(providerId),
		),
	);

	return {
		...parsed,
		providers: filteredProviders,
		pricing: filteredPricing,
	};
}
