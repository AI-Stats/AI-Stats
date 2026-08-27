import type { OpenAICompatConfig } from "../openai-compatible/types";

export const IONROUTER_OPENAI_COMPAT_CONFIGS = {
	ionrouter: {
		providerId: "ionrouter",
		baseUrl: "https://api.ionrouter.io",
		pathPrefix: "/v1",
		apiKeyEnv: "IONROUTER_API_KEY",
		baseUrlEnv: "IONROUTER_BASE_URL",
		supportsResponses: false,
	},
	"ionrouter-kimi": {
		providerId: "ionrouter-kimi",
		baseUrl: "https://kimi.ionrouter.io",
		pathPrefix: "/v1",
		apiKeyEnv: "IONROUTER_API_KEY",
		baseUrlEnv: "IONROUTER_KIMI_BASE_URL",
		supportsResponses: false,
	},
	"ionrouter-minimax": {
		providerId: "ionrouter-minimax",
		baseUrl: "https://minimax.ionrouter.io",
		pathPrefix: "/v1",
		apiKeyEnv: "IONROUTER_API_KEY",
		baseUrlEnv: "IONROUTER_MINIMAX_BASE_URL",
		supportsResponses: false,
	},
} satisfies Record<string, OpenAICompatConfig>;

export function resolveIonRouterUrlProvider(model: string): string {
	const normalized = model.trim().toLowerCase().split("/").pop() ?? "";
	if (normalized === "kimi-k2.5") return "ionrouter-kimi";
	if (normalized === "minimax-m2.5") return "ionrouter-minimax";
	return "ionrouter";
}
