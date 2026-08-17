import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => {
    const store = new Map<string, string>();

    const cache = {
        get: vi.fn(async (key: string, type?: "text" | "json" | "arrayBuffer" | "stream") => {
            const value = store.get(key);
            if (value == null) return null;
            if (type === "json") return JSON.parse(value);
            return value;
        }),
        put: vi.fn(async (key: string, value: string) => {
            store.set(key, value);
        }),
        delete: vi.fn(async (key: string) => {
            store.delete(key);
        }),
    };

    const contextPayload = {
        workspace_id: "team_inflight",
        resolved_model: "resolved/openai-gpt-5-nano",
        key_ok: { ok: true, reason: null },
        key_limit_ok: { ok: true, reason: null },
        credit_ok: { ok: true, reason: null },
        providers: [],
        pricing: {},
    };

    const fetchRequestContext = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return contextPayload;
    });

    return {
        store,
        cache,
        fetchRequestContext,
    };
});

vi.mock("@/runtime/env", () => ({
    getCache: () => runtime.cache as unknown as KVNamespace,
}));

vi.mock("@/repositories/gateway-context", () => ({
    fetchRequestContext: (args: Record<string, unknown>) => runtime.fetchRequestContext(args),
    loadWorkspaceEnrichment: async () => ({ settings: { routing_mode: null, byok_fallback_enabled: false, beta_channel_enabled: false, alpha_channel_enabled: false, cache_aware_routing_enabled: true }, workspace: { billing_mode: "wallet" }, providers: [] }),
    findWallet: async () => null, listByokKeys: async () => [], listRoutes: async () => [], listCapabilities: async () => [], listModels: async () => [], listProviders: async () => [],
}));

describe("fetchGatewayContext inflight dedupe", () => {
    beforeEach(() => {
        runtime.store.clear();
        runtime.cache.get.mockClear();
        runtime.cache.put.mockClear();
        runtime.cache.delete.mockClear();
        runtime.fetchRequestContext.mockClear();
        vi.resetModules();
    });

    it("dedupes concurrent cache misses for the same context key", async () => {
        await runtime.cache.put("gateway:keyver:id:key_inflight", "3");

        const { fetchGatewayContext } = await import("./context");
        const args = {
            workspaceId: "team_inflight",
            model: "openai/gpt-5-nano",
            endpoint: "text.generate",
            apiKeyId: "key_inflight",
            disableCache: false,
        };

        const [a, b, c] = await Promise.all([
            fetchGatewayContext(args),
            fetchGatewayContext(args),
            fetchGatewayContext(args),
        ]);

		// One shared loader fetches both text-capability variants. Without inflight
		// dedupe, the two concurrent callers would issue four repository reads.
		expect(runtime.fetchRequestContext).toHaveBeenCalledTimes(2);
        expect(a.workspaceId).toBe("team_inflight");
        expect(b.workspaceId).toBe("team_inflight");
        expect(c.workspaceId).toBe("team_inflight");
        expect(a).not.toBe(b);
        expect(b).not.toBe(c);
    });
});
