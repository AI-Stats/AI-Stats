import { describe, expect, it, vi } from "vitest";
vi.mock("@/repositories/og", () => ({ findOgPayload: vi.fn(async () => ({ id: "openai/gpt-test", name: "GPT Test", logoId: "openai", badge: "Available" })) }));
import app from "@/index";
const env = { ENV: "development" as const };

describe("public OG payload", () => {
	it("loads visible model metadata without exposing hidden rows", async () => {
		const response = await app.request("https://phaseo.app/api/_web/og?kind=models&id=openai%2Fgpt-test", {}, env);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-tag")).toBe("web-api-og");
		await expect(response.json()).resolves.toEqual({ payload: { id: "openai/gpt-test", name: "GPT Test", logoId: "openai", badge: "Available" } });
	});
});
