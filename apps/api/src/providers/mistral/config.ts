import type { OpenAICompatConfig } from "../openai-compatible/types";

// Mistral's SDK and API reference use MISTRAL_API_KEY. Keep the historical
// Phaseo binding as a fallback so existing deployments continue to work.
export const MISTRAL_API_KEY_ENVS = ["MISTRAL_API_KEY", "MISTRAL_AI_API_KEY"] as const;

export const MISTRAL_OPENAI_COMPAT_CONFIGS = {
	mistral: {
		providerId: "mistral",
		baseUrl: "https://api.mistral.ai",
		pathPrefix: "/v1",
		apiKeyEnv: "MISTRAL_API_KEY",
		baseUrlEnv: "MISTRAL_BASE_URL",
		supportsResponses: false,
	},
	"mistral-eu": {
		providerId: "mistral-eu",
		baseUrl: "https://api.eu.mistral.ai",
		pathPrefix: "/v1",
		apiKeyEnv: "MISTRAL_API_KEY",
		baseUrlEnv: "MISTRAL_EU_BASE_URL",
		supportsResponses: false,
	},
} satisfies Record<string, OpenAICompatConfig>;
