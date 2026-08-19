import { defineProvider } from "../provider";

export const provider = defineProvider({
	id: "requesty",
	name: "Requesty",
	sourceUrl: "https://router.requesty.ai/v1/models",
	apiKeyEnv: "REQUESTY_API_KEY",
});
