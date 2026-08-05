import type { OpenAICompatConfig } from "../openai-compatible/types";

export const META_OPENAI_COMPAT_CONFIGS = {
	meta: {
		providerId: "meta",
		baseUrl: "https://api.meta.ai",
		pathPrefix: "/v1",
		apiKeyEnv: "MODEL_API_KEY",
		baseUrlEnv: "META_MODEL_BASE_URL",
		supportsResponses: true,
	},
	"meta-contributor": {
		providerId: "meta-contributor",
		baseUrl: "https://api.meta.ai",
		pathPrefix: "/v1",
		apiKeyEnv: "MODEL_API_KEY",
		baseUrlEnv: "META_MODEL_BASE_URL",
		supportsResponses: true,
	},
} satisfies Record<string, OpenAICompatConfig>;
