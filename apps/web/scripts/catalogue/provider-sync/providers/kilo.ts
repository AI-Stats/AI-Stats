import { defineProvider } from "../provider";

export const provider = defineProvider({
	id: "kilo",
	name: "Kilo Gateway",
	sourceUrl: "https://api.kilo.ai/api/gateway/models",
	apiKeyEnv: "KILO_API_KEY",
});
