import { describe, expect, it } from "vitest";
import {
	compileExecutionPlan,
	executionPlanCacheKey,
	type ExecutionPlanSource,
} from "./execution-plan";

const source: ExecutionPlanSource = {
	releaseSequence: 7,
	providerModelId: "example/model-a",
	providerId: "example",
	capabilityId: "text.generate",
	routeVariantId: null,
	endpoint: {
		baseUrl: "https://api.example.com",
		pathTemplate: "/v1/chat/completions",
		apiVersion: null,
		timeoutMs: 120_000,
	},
	primitives: {
		requestMapper: "openai.chat.request.v1",
		responseParser: "openai.chat.response.v1",
		streamParser: "openai.chat.sse.v1",
		authSigner: "bearer.v1",
		transport: "http.fetch.v1",
		usageNormalizer: "openai.usage.v1",
		errorNormalizer: "openai.error.v1",
	},
	configLayers: [
		{ precedence: 300, config: { request: { parallelTools: false }, provider: "route" } },
		{ precedence: 100, config: { request: { strictJson: true, parallelTools: true }, provider: "default" } },
	],
	parameterSupport: {
		tools: { level: "native", config: {} },
		response_format: { level: "emulated", config: { mode: "json_object" } },
	},
	constraints: [
		{
			key: "no-parallel-tools-with-schema",
			expression: {
				all: [
					{ path: "parallelToolCalls", op: "equals", value: true },
					{ path: "responseFormat.type", op: "equals", value: "json_schema" },
				],
			},
			outcome: "reject",
			message: "Parallel tools cannot be combined with JSON Schema.",
			priority: 20,
		},
	],
	evidenceCheckedAt: "2026-08-03T12:00:00.000Z",
};

describe("compileExecutionPlan", () => {
	it("applies low-to-high precedence without losing nested defaults", () => {
		const plan = compileExecutionPlan(source);

		expect(plan.config).toEqual({
			request: { strictJson: true, parallelTools: false },
			provider: "route",
		});
	});

	it("rejects unknown primitive binding fields", () => {
		expect(() => compileExecutionPlan({
			...source,
			primitives: { ...source.primitives, arbitraryCode: "nope" } as ExecutionPlanSource["primitives"],
		})).toThrow();
	});

	it("rejects ambiguous config precedence", () => {
		expect(() => compileExecutionPlan({
			...source,
			configLayers: [
				{ precedence: 100, config: { first: true } },
				{ precedence: 100, config: { second: true } },
			],
		})).toThrow("unique precedence");
	});

	it("builds a release-addressed cache key", () => {
		expect(executionPlanCacheKey(compileExecutionPlan(source))).toBe(
			"execution-plan:7:example/model-a:text.generate:default",
		);
	});
});
