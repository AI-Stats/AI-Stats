import { defineProvider } from "../provider";

export const provider = defineProvider({
	id: "novita-ai",
	name: "NovitaAI",
	sourceUrl: "https://api.novita.ai/openai/models",
	apiKeyEnv: "NOVITA_API_KEY",
});
