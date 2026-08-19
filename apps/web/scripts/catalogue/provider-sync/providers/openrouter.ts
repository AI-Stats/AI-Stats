import { defineProvider } from "../provider";

export const provider = defineProvider({
	id: "openrouter",
	name: "OpenRouter",
	sourceUrl: "https://openrouter.ai/api/v1/models",
	apiKeyEnv: "OPENROUTER_API_KEY",
});
