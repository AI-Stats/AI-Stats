import type { OpenAICompatConfig } from "../openai-compatible/types";

export const SAIL_RESEARCH_OPENAI_COMPAT_CONFIG = {
	providerId: "sail-research",
	baseUrl: "https://api.sailresearch.com",
	pathPrefix: "/v1",
	apiKeyEnv: "SAIL_API_KEY",
	baseUrlEnv: "SAIL_BASE_URL",
	supportsResponses: true,
} as const satisfies OpenAICompatConfig;

export const SAIL_RESEARCH_OPENAI_COMPAT_CONFIGS = {
	"sail-research": SAIL_RESEARCH_OPENAI_COMPAT_CONFIG,
} satisfies Record<string, OpenAICompatConfig>;
