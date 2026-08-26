import type { OpenAICompatConfig } from "../openai-compatible/types";

export const CANOPY_WAVE_OPENAI_COMPAT_CONFIG = {
	providerId: "canopy-wave",
	baseUrl: "https://inference.canopywave.io",
	pathPrefix: "/v1",
	apiKeyEnv: "CANOPYWAVE_API_KEY",
	baseUrlEnv: "CANOPYWAVE_BASE_URL",
	supportsResponses: false,
} as const satisfies OpenAICompatConfig;

export const CANOPY_WAVE_OPENAI_COMPAT_CONFIGS = {
	"canopy-wave": CANOPY_WAVE_OPENAI_COMPAT_CONFIG,
} satisfies Record<string, OpenAICompatConfig>;
