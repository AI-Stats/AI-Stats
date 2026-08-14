import type { OpenAICompatConfig } from "../openai-compatible/types";

export const OPENAI_OPENAI_COMPAT_CONFIGS = {
	openai: {
		providerId: "openai",
		baseUrl: "https://api.openai.com",
		pathPrefix: "/v1",
		apiKeyEnv: "OPENAI_API_KEY",
		baseUrlEnv: "OPENAI_BASE_URL",
		supportsResponses: true,
	},
	"openai-eu": {
		providerId: "openai-eu",
		baseUrl: "https://eu.api.openai.com",
		pathPrefix: "/v1",
		apiKeyEnv: "OPENAI_API_KEY",
		supportsResponses: true,
	},
} satisfies Record<string, OpenAICompatConfig>;
