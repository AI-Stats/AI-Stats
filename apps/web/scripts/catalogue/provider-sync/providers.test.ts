import { getProviderSyncProvider, getProviderSyncProviderIds } from "./providers";
import { parseProviderModelList } from "./provider";

describe("provider sync registry", () => {
	test("registers explicit provider modules", () => {
		expect(getProviderSyncProviderIds()).toEqual([
			"deepinfra",
			"fastrouter",
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

	test("does not invent a zero DeepInfra cache price when no cache rate is published", () => {
		const provider = getProviderSyncProvider("deepinfra");
		const [model] = provider!.parseModels({
			current: { data: [{ id: "example/model" }] },
			details: [{
				model_name: "example/model",
				reported_type: "text-generation",
				pricing: {
					type: "tokens",
					cents_per_input_token: 0.00001,
					cents_per_output_token: 0.00002,
					rate_per_input_token_cached: null,
				},
			}],
		});
		expect(model?.details.metadata).toEqual({ pricing: { input_tokens: 0.1, output_tokens: 0.2 } });
	});

	test("parses DeepInfra embedding input-token pricing", () => {
		const provider = getProviderSyncProvider("deepinfra");
		const [model] = provider!.parseModels({
			current: { data: [{ id: "example/embedding-model" }] },
			details: [{
				model_name: "example/embedding-model",
				reported_type: "embeddings",
				pricing: {
					type: "input_tokens",
					cents_per_input_token: 0.000001,
				},
			}],
		});
		expect(model).toEqual(expect.objectContaining({
			details: expect.objectContaining({
				type: "embedding",
				metadata: { pricing: { input_tokens: 0.01 } },
			}),
		}));
	});

	test("joins DeepInfra's current inventory to its detailed pricing feed", async () => {
		const provider = getProviderSyncProvider("deepinfra");
		const originalKey = process.env.DEEPINFRA_API_KEY;
		process.env.DEEPINFRA_API_KEY = "test-deepinfra-key";
		const request = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			if (String(input).includes("v1/openai/models")) {
				expect(init?.headers).toEqual({
					accept: "application/json",
					authorization: "Bearer test-deepinfra-key",
				});
			}
			return new Response(JSON.stringify(
			String(input).includes("v1/openai/models")
				? { data: [{ id: "example/model" }] }
				: [{
					model_name: "example/model",
					reported_type: "text-generation",
					max_tokens: 131072,
					pricing: {
						type: "tokens",
						cents_per_input_token: 0.00001,
						cents_per_output_token: 0.00002,
						rate_per_input_token_cached: 0.2,
					},
				}],
			), { status: 200 });
		});

		try {
			const payload = await provider!.fetchModels(request);
			expect(provider!.parseModels(payload)).toEqual([expect.objectContaining({
				id: "example/model",
				details: expect.objectContaining({
					context_length: 131072,
					metadata: { pricing: { input_tokens: 0.1, output_tokens: 0.2, cache_read_tokens: 0.02 } },
				}),
			})]);
		} finally {
			if (originalKey === undefined) delete process.env.DEEPINFRA_API_KEY;
			else process.env.DEEPINFRA_API_KEY = originalKey;
		}
	});

	test("parses common provider model list envelopes", () => {
		expect(parseProviderModelList({ models: [{ model_id: "example/model" }, { id: "second" }] })).toEqual([
			{ id: "example/model", details: { model_id: "example/model" } },
			{ id: "second", details: { id: "second" } },
		]);
	});

	test("joins every public NanoGPT modality feed", async () => {
		const provider = getProviderSyncProvider("nano-gpt");
		const request = jest.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify({
			data: [{ id: String(input).split("/").at(-1) }],
		}), { status: 200 }));

		const models = provider!.parseModels(await provider!.fetchModels(request));
		expect(request).toHaveBeenCalledTimes(5);
		expect(models.map((model) => model.details.type)).toEqual([
			undefined,
			"image",
			"video",
			"speech",
			"embedding",
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
