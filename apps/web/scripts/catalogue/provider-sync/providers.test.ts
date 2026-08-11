import { getProviderSyncProvider, getProviderSyncProviderIds } from "./providers";
import { parseProviderModelList } from "./provider";

describe("provider sync registry", () => {
	test("registers explicit provider modules", () => {
		expect(getProviderSyncProviderIds()).toEqual([
			"fastrouter",
			"kilo",
			"nano-gpt",
			"novita-ai",
			"openrouter",
			"orcarouter",
			"pioneer",
			"poe",
			"requesty",
			"vercel",
			"zenmux",
		]);
	});

	test("parses common provider model list envelopes", () => {
		expect(parseProviderModelList({ models: [{ model_id: "example/model" }, { id: "second" }] })).toEqual([
			{ id: "example/model", details: { model_id: "example/model" } },
			{ id: "second", details: { id: "second" } },
		]);
	});

	test("fetches provider data with an optional bearer token", async () => {
		const provider = getProviderSyncProvider("openrouter");
		expect(provider).toBeDefined();
		const originalKey = process.env.OPENROUTER_API_KEY;
		process.env.OPENROUTER_API_KEY = "test-openrouter-key";
		const request = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			expect(init?.headers).toEqual({
				accept: "application/json",
				authorization: "Bearer test-openrouter-key",
			});
			return new Response(JSON.stringify({ data: [{ id: "example/model" }] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});

		try {
			const payload = await provider!.fetchModels(request);
			expect(provider!.parseModels(payload)).toEqual([
			{ id: "example/model", details: { id: "example/model" } },
		]);
			expect(request).toHaveBeenCalledWith(provider!.sourceUrl, expect.any(Object));
		} finally {
			if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
			else process.env.OPENROUTER_API_KEY = originalKey;
		}
	});
});
