import assert from "node:assert/strict";
import { defineOpenAICompatibleProvider } from "./_openai-compatible-provider";

async function main(): Promise<void> {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.TEST_PROVIDER_API_KEY;
    const originalFallbackApiKey = process.env.TEST_PROVIDER_FALLBACK_API_KEY;
    process.env.TEST_PROVIDER_API_KEY = "test-key";
    globalThis.fetch = (async () =>
        new Response(JSON.stringify([
            { id: "publisher/model-a" },
            { id: "publisher/model-b" },
        ]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        })) as typeof fetch;

    try {
        const provider = defineOpenAICompatibleProvider({
            providerId: "test-provider",
            name: "Test Provider",
            apiKeyEnv: "TEST_PROVIDER_API_KEY",
            baseUrl: "https://api.example.com",
            pathPrefix: "/v1",
        });

        const models = await provider.fetchModels();
        assert.deepEqual(models.map((model) => model.id), [
            "publisher/model-a",
            "publisher/model-b",
        ]);

        delete process.env.TEST_PROVIDER_API_KEY;
        process.env.TEST_PROVIDER_FALLBACK_API_KEY = "fallback-key";
        const fallbackProvider = defineOpenAICompatibleProvider({
            providerId: "fallback-provider",
            name: "Fallback Provider",
            apiKeyEnv: ["TEST_PROVIDER_API_KEY", "TEST_PROVIDER_FALLBACK_API_KEY"],
            baseUrl: "https://api.example.com",
            pathPrefix: "/v1",
        });

        assert.deepEqual(fallbackProvider.requiredEnv, ["TEST_PROVIDER_FALLBACK_API_KEY"]);
        const fallbackModels = await fallbackProvider.fetchModels();
        assert.deepEqual(fallbackModels.map((model) => model.id), [
            "publisher/model-a",
            "publisher/model-b",
        ]);
    } finally {
        globalThis.fetch = originalFetch;
        if (originalApiKey === undefined) {
            delete process.env.TEST_PROVIDER_API_KEY;
        } else {
            process.env.TEST_PROVIDER_API_KEY = originalApiKey;
        }
        if (originalFallbackApiKey === undefined) {
            delete process.env.TEST_PROVIDER_FALLBACK_API_KEY;
        } else {
            process.env.TEST_PROVIDER_FALLBACK_API_KEY = originalFallbackApiKey;
        }
    }
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
});
