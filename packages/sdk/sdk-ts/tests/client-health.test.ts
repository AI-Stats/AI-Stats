import { describe, expect, test, vi } from "vitest";
import { Phaseo } from "../src/index.js";

describe("Phaseo health helper", () => {
  test("calls /health through getHealth", async () => {
    const fetchImpl: typeof fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://example.test/health");
      expect(init?.method).toBe("GET");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer sk_test_123",
      });
      return new Response(
        JSON.stringify({
          status: "ok",
          timestamp: "2026-05-05T12:00:00.000Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as unknown as typeof fetch;

    const client = new Phaseo({
      apiKey: "sk_test_123",
      baseUrl: "https://example.test",
      fetchImpl,
    });

    const response = await client.getHealth();

    expect(response.status).toBe("ok");
    expect(response.timestamp).toBe("2026-05-05T12:00:00.000Z");
  });

  test("adds app attribution only when explicitly configured", async () => {
    const fetchImpl: typeof fetch = vi.fn(async (_input, init) => {
      expect(init?.headers).toMatchObject({
        "X-App-Id": "support-console",
        "X-App-Name": "Support Console",
        "HTTP-Referer": "https://support.example.com",
      });
      return new Response(JSON.stringify({ status: "ok", timestamp: "2026-08-19T00:00:00.000Z" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const client = new Phaseo({
      apiKey: "sk_test_123",
      baseUrl: "https://example.test",
      fetchImpl,
      app: { id: "support-console", name: "Support Console", url: "https://support.example.com" },
    });

    await client.getHealth();
  });
});
