import type { OpenAICompatConfig } from "../openai-compatible/types";

export const RELACE_OPENAI_COMPAT_CONFIGS = {
	relace: {
		providerId: "relace",
		// Relace's general infrastructure API is not a model endpoint. The
		// OpenAI-compatible relace-search model has its own documented prefix.
		baseUrl: "https://models.relace.ai",
		pathPrefix: "/v1/search",
		apiKeyEnv: "RELACE_API_KEY",
		baseUrlEnv: "RELACE_BASE_URL",
	},
} satisfies Record<string, OpenAICompatConfig>;
