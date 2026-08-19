import type { OpenAICompatConfig } from "../openai-compatible/types";

export const PHALA_OPENAI_COMPAT_CONFIGS = {
	phala: {
		providerId: "phala",
		baseUrl: "https://inference.phala.com",
		pathPrefix: "/v1",
		apiKeyEnv: "PHALA_API_KEY",
		baseUrlEnv: "PHALA_BASE_URL",
		supportsResponses: false,
	},
} satisfies Record<string, OpenAICompatConfig>;
