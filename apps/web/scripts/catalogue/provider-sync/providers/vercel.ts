import { defineProvider } from "../provider";

export const provider = defineProvider({
	id: "vercel",
	name: "Vercel AI Gateway",
	sourceUrl: "https://ai-gateway.vercel.sh/v1/models",
});
