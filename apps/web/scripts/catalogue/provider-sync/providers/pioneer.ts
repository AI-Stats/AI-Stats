import { defineProvider } from "../provider";

export const provider = defineProvider({
	id: "pioneer",
	name: "Pioneer",
	sourceUrl: "https://api.pioneer.ai/v1/models",
	apiKeyEnv: "PIONEER_API_KEY",
});
