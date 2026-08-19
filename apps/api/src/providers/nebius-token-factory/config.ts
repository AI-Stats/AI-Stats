import type { OpenAICompatConfig } from "../openai-compatible/types";

export const NEBIUS_TOKEN_FACTORY_API_KEY_ENVS = ["NEBIUS_API_KEY", "NEBIUS_TOKEN_FACTORY_API_KEY"] as const;
export const NEBIUS_EU_NORTH_1_BASE_URL_ENVS = ["NEBIUS_EU_NORTH_1_BASE_URL", "NEBIUS_BASE_URL"] as const;
export const NEBIUS_US_CENTRAL_1_BASE_URL_ENVS = ["NEBIUS_US_CENTRAL_1_BASE_URL", "NEBIUS_BASE_URL"] as const;

// Nebius publishes Responses API support per model in its live model catalog.
// Chat remains the safe fallback for models that do not advertise it.
const NEBIUS_RESPONSES_MODELS = new Set([
	"deepseek-ai/deepseek-v4-pro",
	"meta-llama/llama-3.3-70b-instruct",
	"minimaxai/minimax-m2.5",
	"moonshotai/kimi-k2.6",
	"nousresearch/hermes-4-405b",
	"nousresearch/hermes-4-70b",
	"nvidia/nvidia-nemotron-3-nano-30b-a3b",
	"nvidia/nemotron-3-nano-omni",
	"nvidia/nemotron-3-ultra-550b-a55b",
	"nvidia/nemotron-3_5-lightning",
	"qwen/qwen2.5-vl-72b-instruct",
	"qwen/qwen3-235b-a22b-instruct-2507",
	"qwen/qwen3-30b-a3b-instruct-2507",
	"qwen/qwen3-32b",
	"qwen/qwen3.5-397b-a17b",
	"zai-org/glm-5.1",
]);

export function nebiusModelSupportsResponses(model?: string | null): boolean {
	const normalized = String(model ?? "").trim().toLowerCase().replace(/-fast$/, "");
	return NEBIUS_RESPONSES_MODELS.has(normalized);
}

export const NEBIUS_TOKEN_FACTORY_OPENAI_COMPAT_CONFIGS = {
	"nebius-token-factory": {
		providerId: "nebius-token-factory",
		baseUrl: "https://api.tokenfactory.nebius.com",
		pathPrefix: "/v1",
		apiKeyEnv: "NEBIUS_API_KEY",
		baseUrlEnv: "NEBIUS_BASE_URL",
		supportsResponses: false,
	},
	"nebius-token-factory-fast": {
		providerId: "nebius-token-factory-fast",
		baseUrl: "https://api.tokenfactory.nebius.com",
		pathPrefix: "/v1",
		apiKeyEnv: "NEBIUS_API_KEY",
		baseUrlEnv: "NEBIUS_BASE_URL",
		supportsResponses: false,
	},
	"nebius-token-factory-eu-north-1": {
		providerId: "nebius-token-factory-eu-north-1",
		baseUrl: "https://api.tokenfactory.nebius.com",
		pathPrefix: "/v1",
		apiKeyEnv: "NEBIUS_API_KEY",
		baseUrlEnv: "NEBIUS_EU_NORTH_1_BASE_URL",
		supportsResponses: false,
	},
	"nebius-token-factory-us-central-1": {
		providerId: "nebius-token-factory-us-central-1",
		baseUrl: "https://api.tokenfactory.us-central1.nebius.com",
		pathPrefix: "/v1",
		apiKeyEnv: "NEBIUS_API_KEY",
		baseUrlEnv: "NEBIUS_US_CENTRAL_1_BASE_URL",
		supportsResponses: false,
	},
} satisfies Record<string, OpenAICompatConfig>;
