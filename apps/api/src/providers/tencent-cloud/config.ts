import type { OpenAICompatConfig } from "../openai-compatible/types";

export const TENCENT_CLOUD_OPENAI_COMPAT_CONFIGS = {
	"tencent-cloud": {
		providerId: "tencent-cloud",
		// Use the international endpoint by default so the gateway does not
		// accidentally claim mainland-China data residency. Deployments with a
		// Guangzhou service can override this binding explicitly.
		baseUrl: "https://tokenhub-intl.tencentcloudmaas.com",
		pathPrefix: "/v1",
		apiKeyEnv: "TENCENT_CLOUD_TOKENHUB_API_KEY",
		baseUrlEnv: "TENCENT_CLOUD_TOKENHUB_BASE_URL",
		supportsResponses: false,
	},
} satisfies Record<string, OpenAICompatConfig>;
