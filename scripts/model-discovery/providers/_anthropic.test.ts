import assert from "node:assert/strict";
import anthropic from "./anthropic";

async function main(): Promise<void> {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    globalThis.fetch = (async (_input, init) => {
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("x-api-key"), "sk-ant-test");
        assert.equal(headers.get("authorization"), null);
        assert.equal(headers.get("anthropic-version"), "2023-06-01");
        return new Response(JSON.stringify({ data: [{ id: "claude-test" }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }) as typeof fetch;

    try {
        const models = await anthropic.fetchModels();
        assert.deepEqual(models.map((model) => model.id), ["claude-test"]);
    } finally {
        globalThis.fetch = originalFetch;
        if (originalApiKey === undefined) {
            delete process.env.ANTHROPIC_API_KEY;
        } else {
            process.env.ANTHROPIC_API_KEY = originalApiKey;
        }
    }
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
});
