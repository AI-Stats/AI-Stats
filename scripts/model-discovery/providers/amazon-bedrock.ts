import { defineOpenAICompatibleProvider } from "./_openai-compatible-provider";

export default defineOpenAICompatibleProvider({
    providerId: "amazon-bedrock",
    name: "Amazon Bedrock",
    apiKeyEnv: ["AMAZON_BEDROCK_API_KEY", "AMAZON_BEDROCK_MANTLE_API_KEY"],
    baseUrl: "https://bedrock-mantle.us-east-1.api.aws",
    baseUrlEnv: "AMAZON_BEDROCK_MANTLE_BASE_URL",
    pathPrefix: "/v1",
});

