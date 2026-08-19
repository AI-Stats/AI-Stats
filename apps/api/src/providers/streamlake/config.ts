import type { OpenAICompatConfig } from "../openai-compatible/types";

export const STREAMLAKE_OPENAI_COMPAT_CONFIGS = {
	streamlake: {
		// The gateway uses StreamLake's pay-as-you-go OpenAI-compatible surface.
		// Coding Plan URLs are restricted to approved developer tools.
		providerId: "streamlake",
		baseUrl: "https://vanchin.streamlake.ai",
		pathPrefix: "/api/gateway/v1/endpoints",
		apiKeyEnv: "STREAMLAKE_API_KEY",
		baseUrlEnv: "STREAMLAKE_BASE_URL",
	},
} satisfies Record<string, OpenAICompatConfig>;
