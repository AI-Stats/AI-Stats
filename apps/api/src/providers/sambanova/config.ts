import type { OpenAICompatConfig } from "../openai-compatible/types";

export const SAMBANOVA_OPENAI_COMPAT_CONFIGS = {
	sambanova: {
		providerId: "sambanova",
		baseUrl: "https://api.sambanova.ai",
		apiKeyEnv: "SAMBANOVA_API_KEY",
		baseUrlEnv: "SAMBANOVA_BASE_URL",
		pathPrefix: "/v1",
		supportsResponses: true,
	},
} satisfies Record<string, OpenAICompatConfig>;
