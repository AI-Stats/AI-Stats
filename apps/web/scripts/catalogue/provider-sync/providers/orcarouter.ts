import { defineProvider } from "../provider";

export const provider = defineProvider({
	id: "orcarouter",
	name: "OrcaRouter",
	sourceUrl: "https://api.orcarouter.ai/v1/models",
	apiKeyEnv: "ORCAROUTER_API_KEY",
});
