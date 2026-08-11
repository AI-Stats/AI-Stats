import { defineProvider } from "../provider";

export const provider = defineProvider({
	id: "nano-gpt",
	name: "NanoGPT",
	sourceUrl: "https://nano-gpt.com/api/v1/models?detailed=true",
	apiKeyEnv: "NANOGPT_API_KEY",
});
