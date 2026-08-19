// Purpose: Meta Model API OpenAI-compatible routing coverage.
// Why: Muse Spark uses the Responses API and the Meta Model API key only.
// How: Tests route, URL, and gateway key resolution in isolation from provider-wide fixtures.

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupRuntimeFromEnv, setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { openAICompatUrl, resolveOpenAICompatKey, resolveOpenAICompatRoute } from "../config";

beforeAll(() => {
	setupTestRuntime();
});

afterAll(() => {
	teardownTestRuntime();
});

describe("Meta OpenAI-compatible config", () => {
	it("keeps standard and contributor editions as separate models in one family", () => {
		const catalogRoot = path.resolve(process.cwd(), "../../packages/data/catalog/src/data");
		const readCatalogJson = (relativePath: string) => JSON.parse(
			readFileSync(path.join(catalogRoot, relativePath), "utf8"),
		);
		const standard = readCatalogJson("models/meta/muse-spark-1.2/model.json");
		const contributor = readCatalogJson("models/meta/muse-spark-1.2-contributor/model.json");
		const contributorRoute = readCatalogJson("api_providers/meta-contributor/models.json")[0];
		const standardProvider = readCatalogJson("api_providers/meta/api_provider.json");
		const contributorProvider = readCatalogJson("api_providers/meta-contributor/api_provider.json");
		const manifest = readCatalogJson("manifest.json");

		expect(standard.model_id).toBe("meta/muse-spark-1.2");
		expect(contributor.model_id).toBe("meta/muse-spark-1.2-contributor");
		expect(standard.family_id).toBe("meta/muse-spark-1.2");
		expect(contributor.family_id).toBe(standard.family_id);
		expect(contributorRoute.canonical_model_id).toBe(contributor.model_id);
		expect(contributorRoute.internal_model_id).toBe(contributor.model_id);
		expect(contributorRoute.provider_api_model_id).toBe(
			"meta-contributor:meta/muse-spark-1.2-contributor",
		);
		expect(contributorRoute.provider_model_slug).toBe("muse-spark-1.2-contributor");
		expect(standardProvider.prompt_training_policy).toBe("no_train");
		expect(contributorProvider.prompt_training_policy).toBe("may_train");
		expect(manifest.families).toContain("meta-muse-spark-1.2");
	});

	it("routes Muse Spark models through Responses", () => {
		expect(resolveOpenAICompatRoute("meta", "muse-spark-1.1")).toBe("responses");
		expect(resolveOpenAICompatRoute("meta", "muse-spark-1.2")).toBe("responses");
		expect(resolveOpenAICompatRoute("meta-contributor", "muse-spark-1.2-contributor")).toBe("responses");
	});

	it("builds the Meta Model API responses endpoint", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({
			META_MODEL_API_KEY: "test-meta-key",
		} as any);

		expect(openAICompatUrl("meta", "/responses")).toBe(
			"https://api.meta.ai/v1/responses",
		);
		expect(openAICompatUrl("meta-contributor", "/responses")).toBe(
			"https://api.meta.ai/v1/responses",
		);
	});

	it("supports the gateway and official Meta Model API key names", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({
			META_MODEL_API_KEY: "test-meta-key",
		} as any);

		const resolved = resolveOpenAICompatKey({
			providerId: "meta",
			byokMeta: [],
		} as any);

		expect(resolved.key).toBe("test-meta-key");

		teardownTestRuntime();
		setupRuntimeFromEnv({
			MODEL_API_KEY: "test-official-meta-key",
		} as any);

		expect(resolveOpenAICompatKey({
			providerId: "meta",
			byokMeta: [],
		} as any).key).toBe("test-official-meta-key");
		expect(resolveOpenAICompatKey({
			providerId: "meta-contributor",
			byokMeta: [],
		} as any).key).toBe("test-official-meta-key");

		teardownTestRuntime();
		setupRuntimeFromEnv({
			MODEL_API_KEY: "test-official-meta-key",
			META_MODEL_API_KEY: "test-legacy-meta-key",
		} as any);

		expect(resolveOpenAICompatKey({
			providerId: "meta",
			byokMeta: [],
		} as any).key).toBe("test-official-meta-key");

		teardownTestRuntime();
		setupRuntimeFromEnv({
			LLAMA_API_KEY: "test-llama-key",
		} as any);

		expect(() => resolveOpenAICompatKey({
			providerId: "meta",
			byokMeta: [],
		} as any)).toThrowError("meta_key_missing");
	});
});
