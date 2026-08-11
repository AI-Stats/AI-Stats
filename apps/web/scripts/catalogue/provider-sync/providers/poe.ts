import { defineProvider } from "../provider";

export const provider = defineProvider({
	id: "poe",
	name: "Poe",
	sourceUrl: "https://api.poe.com/v1/models",
	apiKeyEnv: "POE_API_KEY",
});
