import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCurieOutput, outputCost, summariseCurieResults, validateCurieConfig, validateCurieEndpoint, type CurieResult } from "../src/curie.ts";

test("validates a minimal local run", () => {
	const config = validateCurieConfig({ models: ["phaseo/test"], cases: [{ id: "hello", input: "Say hello" }] });
	assert.equal(config.models.length, 1);
	assert.equal(config.cases[0]?.id, "hello");
});

test("rejects incomplete and duplicated cases", () => {
	assert.throws(() => validateCurieConfig({ models: [], cases: [] }), /at least one model/);
	assert.throws(() => validateCurieConfig({ models: ["test"], cases: [{ id: "same", input: "a" }, { id: "same", input: "b" }] }), /Duplicate case id/);
	assert.throws(() => validateCurieConfig({ models: ["test"], cases: [{ id: "missing" }] }), /requires input or messages/);
});

test("supports deterministic output expectations", () => {
	assert.equal(evaluateCurieOutput("hello world", { contains: "world" }), true);
	assert.equal(evaluateCurieOutput("hello world", { equals: "hello" }), false);
	assert.equal(evaluateCurieOutput("Order 42", { regex: "^Order \\d+$" }), true);
});

test("prevents configs from redirecting arbitrary environment secrets", () => {
	assert.throws(
		() => validateCurieEndpoint("https://collector.example/v1", "AWS_SECRET_ACCESS_KEY", true),
		/PHASEO_API_KEY or PHASEO_CURIE_API_KEY/,
	);
	assert.throws(
		() => validateCurieEndpoint("https://collector.example/v1", "PHASEO_CURIE_API_KEY", false),
		/--allow-custom-base-url/,
	);
	assert.throws(
		() => validateCurieEndpoint("https://collector.example/v1", "PHASEO_API_KEY", true),
		/isolated PHASEO_CURIE_API_KEY/,
	);
	assert.equal(
		validateCurieEndpoint("https://collector.example/v1/", "PHASEO_CURIE_API_KEY", true),
		"https://collector.example/v1",
	);
	assert.throws(
		() => validateCurieEndpoint("http://collector.example/v1", "PHASEO_CURIE_API_KEY", true),
		/Remote custom Curie endpoints must use HTTPS/,
	);
	assert.equal(
		validateCurieEndpoint("http://127.0.0.1:8787/v1/", "PHASEO_CURIE_API_KEY", true),
		"http://127.0.0.1:8787/v1",
	);
	assert.equal(
		validateCurieEndpoint("http://[::1]:8787/v1", "PHASEO_CURIE_API_KEY", true),
		"http://[::1]:8787/v1",
	);
	assert.equal(validateCurieEndpoint("https://api.phaseo.app/v1", "PHASEO_API_KEY", false), "https://api.phaseo.app/v1");
});

test("summarises pass rate, latency, tokens, and reported cost", () => {
	const results: CurieResult[] = [
		{ model: "a", label: "A", caseId: "one", repeat: 1, ok: true, passed: true, latencyMs: 100, output: "ok", totalTokens: 10, reportedCost: 0.01 },
		{ model: "a", label: "A", caseId: "two", repeat: 1, ok: true, passed: false, latencyMs: 300, output: "no", totalTokens: 20, reportedCost: 0.02 },
	];
	assert.deepEqual(summariseCurieResults(results), [{ model: "a", label: "A", runs: 2, successRate: 1, passRate: 0.5, averageLatencyMs: 200, totalTokens: 30, reportedCost: 0.03 }]);
});

test("normalises Phaseo response costs to dollars", () => {
	assert.equal(outputCost({ usage: { pricing: { total_nanos: 25_000_000 } } }), 0.025);
	assert.equal(outputCost({ usage: { pricing: { total_cents: 2.5 } } }), 0.025);
	assert.equal(outputCost({ usage: { pricing: { total_usd_str: "0.025" } } }), 0.025);
	assert.equal(outputCost({ cost_nanos: 25_000_000 }), 0.025);
	assert.equal(outputCost({ cost_cents: 2.5 }), 0.025);
});
