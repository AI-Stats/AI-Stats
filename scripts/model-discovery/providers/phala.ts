import { defineOpenAICompatibleProvider } from "./_openai-compatible-provider";

export default defineOpenAICompatibleProvider({
    providerId: "phala",
    name: "Phala",
    apiKeyEnv: "PHALA_API_KEY",
    baseUrl: "https://inference.phala.com",
    baseUrlEnv: "PHALA_BASE_URL",
    pathPrefix: "/v1",
    providerAttribution: "phala",
    additionalModelPaths: ["/embeddings/models"],
});
