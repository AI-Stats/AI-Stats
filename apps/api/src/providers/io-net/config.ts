import type { OpenAICompatConfig } from "../openai-compatible/types";

export const IO_NET_OPENAI_COMPAT_CONFIGS = {
	"io-net": {
		providerId: "io-net",
		baseUrl: "https://api.intelligence.io.solutions/api/v1",
		pathPrefix: "",
		apiKeyEnv: "IOINTELLIGENCE_API_KEY",
		baseUrlEnv: "IOINTELLIGENCE_BASE_URL",
		supportsResponses: false,
	},
} satisfies Record<string, OpenAICompatConfig>;
