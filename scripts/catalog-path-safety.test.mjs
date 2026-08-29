import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
	parseCanonicalModelId,
	resolveCatalogPath,
} from "./catalog-path-safety.mjs";

test("accepts ordinary canonical model ids", () => {
	assert.deepEqual(parseCanonicalModelId("z-ai/glm-5.3"), ["z-ai", "glm-5.3"]);
	assert.deepEqual(parseCanonicalModelId("meta/llama_4@2026-08"), ["meta", "llama_4@2026-08"]);
});

test("rejects traversal and ambiguous remote model ids", () => {
	for (const value of [
		"../outside",
		"publisher/../outside",
		"publisher/model/extra",
		"publisher\\model",
		"/absolute/model",
		"C:/absolute",
		"publisher/%2e%2e",
		"publisher/NUL",
	]) {
		assert.throws(() => parseCanonicalModelId(value), /Invalid/);
	}
});

test("resolves validated paths inside the catalog root", () => {
	const root = path.resolve("catalog-root");
	assert.equal(
		resolveCatalogPath(root, "models", "z-ai", "glm-5.3", "model.json"),
		path.join(root, "models", "z-ai", "glm-5.3", "model.json"),
	);
	assert.throws(() => resolveCatalogPath(root, "models", "..", "outside"), /Invalid/);
});
