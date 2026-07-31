import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCurieOutput, summariseCurieResults, validateCurieConfig, type CurieResult } from "../src/curie.ts";

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

test("summarises pass rate, latency, tokens, and reported cost", () => {
	const results: CurieResult[] = [
		{ model: "a", label: "A", caseId: "one", repeat: 1, ok: true, passed: true, latencyMs: 100, output: "ok", totalTokens: 10, reportedCost: 0.01 },
		{ model: "a", label: "A", caseId: "two", repeat: 1, ok: true, passed: false, latencyMs: 300, output: "no", totalTokens: 20, reportedCost: 0.02 },
	];
	assert.deepEqual(summariseCurieResults(results), [{ model: "a", label: "A", runs: 2, successRate: 1, passRate: 0.5, averageLatencyMs: 200, totalTokens: 30, reportedCost: 0.03 }]);
});
