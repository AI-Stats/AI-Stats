import { describe, expect, test, vi } from "vitest";
import { Phaseo } from "../src/index.js";

describe("Phaseo Guardrails helpers", () => {
  test("exposes CRUD and assignment operations with exact paths and bodies", async () => {
    const seen: Array<{ method: string; url: string; body?: unknown }> = [];
    const fetchImpl: typeof fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({
        method: String(init?.method ?? "GET"),
        url: String(input),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      });
      return new Response(JSON.stringify({ data: [], deleted: true, removed_count: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const client = new Phaseo({
      apiKey: "pk_test_123",
      baseUrl: "https://example.test",
      fetchImpl,
    });

    await client.listGuardrails({ limit: 25, offset: 5 });
    await client.createGuardrail({ name: "Production", privacyZdrOnly: true });
    await client.getGuardrail("gr_1");
    await client.updateGuardrail("gr_1", { enabled: false });
    await client.deleteGuardrail("gr_1");
    await client.listGuardrailKeys("gr_1");
    await client.replaceGuardrailKeys("gr_1", { key_ids: ["key_1"] });
    await client.addGuardrailKeys("gr_1", { key_ids: ["key_2"] });
    await client.removeGuardrailKeys("gr_1", { key_ids: ["key_1"] });
    await client.listGuardrailMembers("gr_1");
    await client.addGuardrailMembers("gr_1", { user_ids: ["user_1"] });
    await client.removeGuardrailMembers("gr_1", { user_ids: ["user_1"] });

    expect(seen).toEqual([
      { method: "GET", url: "https://example.test/guardrails?limit=25&offset=5", body: undefined },
      { method: "POST", url: "https://example.test/guardrails", body: { name: "Production", privacyZdrOnly: true } },
      { method: "GET", url: "https://example.test/guardrails/gr_1", body: undefined },
      { method: "PATCH", url: "https://example.test/guardrails/gr_1", body: { enabled: false } },
      { method: "DELETE", url: "https://example.test/guardrails/gr_1", body: undefined },
      { method: "GET", url: "https://example.test/guardrails/gr_1/keys", body: undefined },
      { method: "PUT", url: "https://example.test/guardrails/gr_1/keys", body: { key_ids: ["key_1"] } },
      { method: "POST", url: "https://example.test/guardrails/gr_1/keys/add", body: { key_ids: ["key_2"] } },
      { method: "POST", url: "https://example.test/guardrails/gr_1/keys/remove", body: { key_ids: ["key_1"] } },
      { method: "GET", url: "https://example.test/guardrails/gr_1/members", body: undefined },
      { method: "POST", url: "https://example.test/guardrails/gr_1/members/add", body: { user_ids: ["user_1"] } },
      { method: "POST", url: "https://example.test/guardrails/gr_1/members/remove", body: { user_ids: ["user_1"] } },
    ]);
  });
});
