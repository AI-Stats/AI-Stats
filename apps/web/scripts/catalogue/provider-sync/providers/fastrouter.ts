import { defineProvider } from "../provider";

export const provider = defineProvider({
	id: "fastrouter",
	name: "FastRouter",
	sourceUrl: "https://go.fastrouter.ai/api/v1/models",
	apiKeyEnv: "FASTRAOUTER_API_KEY",
});
