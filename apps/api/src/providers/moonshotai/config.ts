import type { OpenAICompatConfig } from "../openai-compatible/types";

export const MOONSHOT_API_KEY_ENVS = ["MOONSHOT_API_KEY", "MOONSHOT_AI_API_KEY"] as const;

const common = {
	baseUrl: "https://api.moonshot.ai",
	pathPrefix: "/v1",
	apiKeyEnv: "MOONSHOT_API_KEY",
	baseUrlEnv: "MOONSHOT_AI_BASE_URL",
} as const;

export const MOONSHOT_OPENAI_COMPAT_CONFIGS = {
	"moonshot-ai": {
		providerId: "moonshot-ai",
		...common,
	},
	moonshotai: {
		providerId: "moonshotai",
		...common,
	},
	"moonshot-ai-turbo": {
		providerId: "moonshot-ai-turbo",
		...common,
	},
	"moonshotai-turbo": {
		providerId: "moonshotai-turbo",
		...common,
	},
} satisfies Record<string, OpenAICompatConfig>;
