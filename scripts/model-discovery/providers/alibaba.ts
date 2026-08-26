import { defineOpenAICompatibleProvider } from "./_openai-compatible-provider";

export default defineOpenAICompatibleProvider({
    providerId: "alibaba-cloud",
    name: "Alibaba Cloud",
    apiKeyEnv: "ALIBABA_CLOUD_API_KEY",
    baseUrl: "https://dashscope-intl.aliyuncs.com",
    baseUrlEnv: "ALIBABA_BASE_URL",
    pathPrefix: "/compatible-mode/v1",
});
