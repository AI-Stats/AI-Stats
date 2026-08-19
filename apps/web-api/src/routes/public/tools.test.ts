import { afterEach, describe, expect, it, vi } from "vitest";
import app from "@/index";
import type { Env } from "@/env";

const allowLimiter = {
	limit: vi.fn().mockResolvedValue({ success: true }),
};

function env(overrides: Partial<Env> = {}): Env {
	return {
		ENV: "development" as const,
		OPENAI_API_KEY: "test-key",
		CONTENT_PROVENANCE_RATE_LIMITER: allowLimiter,
		...overrides,
	} as Env;
}

function uploadRequest(file: File) {
	const body = new FormData();
	body.append("file", file);
	return new Request("https://phaseo.app/api/_web/tools/content-provenance", {
		method: "POST",
		headers: { "Content-Length": "1024" },
		body,
	});
}

afterEach(() => {
	vi.restoreAllMocks();
	allowLimiter.limit.mockClear();
});

describe("POST /api/_web/tools/content-provenance", () => {
	it("forwards supported media to OpenAI without caching it", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
			object: "content_provenance_check",
			created_at: 1_778_000_000,
			results: [{ type: "synthid", outcome: "detected", model: "gpt-image" }],
		}), { status: 200, headers: { "Content-Type": "application/json" } }));

		const response = await app.request(uploadRequest(new File(["image"], "sample.png", { type: "image/png" })), undefined, env());

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(allowLimiter.limit).toHaveBeenCalledOnce();
		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://api.openai.com/v1/content_provenance_checks");
		expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
		const upstreamFile = (init?.body as FormData).get("file") as File;
		expect(upstreamFile.name).toBe("sample.png");
		expect(upstreamFile.type).toBe("image/png");
	});

	it("rejects unsupported files before calling OpenAI", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch");
		const response = await app.request(uploadRequest(new File(["hello"], "notes.txt", { type: "text/plain" })), undefined, env());
		expect(response.status).toBe(415);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects uploads without a valid bounded content length", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch");
		const response = await app.request(new Request(
			"https://phaseo.app/api/_web/tools/content-provenance",
			{ method: "POST", body: new FormData() },
		), undefined, env());

		expect(response.status).toBe(411);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns 429 when the Cloudflare limiter rejects the request", async () => {
		const response = await app.request(
			uploadRequest(new File(["image"], "sample.png", { type: "image/png" })),
			undefined,
			env({ CONTENT_PROVENANCE_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: false }) } }),
		);
		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("60");
	});

	it("fails closed in production when the limiter is missing", async () => {
		const response = await app.request(
			uploadRequest(new File(["image"], "sample.png", { type: "image/png" })),
			undefined,
			env({ ENV: "production", CONTENT_PROVENANCE_RATE_LIMITER: undefined }),
		);
		expect(response.status).toBe(503);
	});
});
