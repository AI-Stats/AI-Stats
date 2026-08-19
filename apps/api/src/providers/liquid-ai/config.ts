import type { OpenAICompatConfig } from "../openai-compatible/types";

export const LIQUID_AI_API_KEY_ENVS = ["LIQUID_API_KEY", "LIQUID_AI_API_KEY"] as const;

export const LIQUID_AI_OPENAI_COMPAT_CONFIGS = {
	liquid: {
		providerId: "liquid",
		pathPrefix: "/v1",
		apiKeyEnv: "LIQUID_API_KEY",
		baseUrlEnv: "LIQUID_BASE_URL",
		supportsResponses: false,
	},
	"liquid-ai": {
		providerId: "liquid-ai",
		pathPrefix: "/v1",
		apiKeyEnv: "LIQUID_AI_API_KEY",
		baseUrlEnv: "LIQUID_AI_BASE_URL",
		supportsResponses: false,
	},
} satisfies Record<string, OpenAICompatConfig>;
