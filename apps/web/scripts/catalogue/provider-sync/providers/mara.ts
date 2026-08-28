import { defineProvider } from "../provider";

export const provider = defineProvider({
	id: "mara",
	name: "Mara",
	sourceUrl: "https://api.cloud.mara.com/v1/models",
	apiKeyEnv: "MARA_API_KEY",
});
