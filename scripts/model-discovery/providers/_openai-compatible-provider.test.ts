import assert from "node:assert/strict";
import { defineOpenAICompatibleProvider } from "./_openai-compatible-provider";
import phala from "./phala";

async function main(): Promise<void> {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.TEST_PROVIDER_API_KEY;
    const originalFallbackApiKey = process.env.TEST_PROVIDER_FALLBACK_API_KEY;
    const originalPhalaApiKey = process.env.PHALA_API_KEY;
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

        process.env.PHALA_API_KEY = "phala-test-key";
        const requestedUrls: string[] = [];
        globalThis.fetch = (async (input) => {
            const url = String(input);
            requestedUrls.push(url);
            const payload = url.endsWith("/embeddings/models")
                ? {
                      data: [
                          { id: "sentence-transformers/all-minilm-l6-v2", providers: ["phala"] },
                          { id: "qwen/qwen3-embedding-8b", providers: ["chutes"] },
                      ],
                  }
                : {
                      data: [
                          { id: "phala/model-a", providers: ["phala"] },
                          { id: "other-provider/model", providers: ["other-provider"] },
                      ],
                  };
            return new Response(JSON.stringify(payload), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }) as typeof fetch;

        const phalaModels = await phala.fetchModels();
        assert.deepEqual(phalaModels.map((model) => model.id), [
            "phala/model-a",
            "sentence-transformers/all-minilm-l6-v2",
        ]);
        assert.deepEqual(requestedUrls, [
            "https://inference.phala.com/v1/models",
            "https://inference.phala.com/v1/embeddings/models",
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
        if (originalPhalaApiKey === undefined) {
            delete process.env.PHALA_API_KEY;
        } else {
            process.env.PHALA_API_KEY = originalPhalaApiKey;
        }
    }
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
});
