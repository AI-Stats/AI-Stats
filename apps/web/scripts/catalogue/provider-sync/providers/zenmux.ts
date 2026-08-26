import { defineProvider } from "../provider";

export const provider = defineProvider({
	id: "zenmux",
	name: "ZenMux",
	sourceUrl: "https://zenmux.ai/api/v1/models",
	apiKeyEnv: "ZENMUX_API_KEY",
});
