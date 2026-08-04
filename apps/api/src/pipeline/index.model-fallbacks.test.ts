import { beforeEach, describe, expect, it, vi } from "vitest";

const { beforeRequestMock, runnerMock } = vi.hoisted(() => ({
	beforeRequestMock: vi.fn(),
	runnerMock: vi.fn(),
}));

vi.mock("./before", () => ({ beforeRequest: beforeRequestMock }));
vi.mock("./registry", () => ({ resolvePipeline: () => runnerMock }));
vi.mock("@core/error-handler", () => ({ handleError: vi.fn(async ({ res }: { res: Response }) => res) }));
vi.mock("./audit", () => ({ auditFailure: vi.fn() }));
vi.mock("./error-response", () => ({
	buildPipelineExecutionErrorResponse: vi.fn(() => new Response(null, { status: 500 })),
	logPipelineExecutionError: vi.fn(),
}));

import { makeEndpointHandler } from "./index";

function context(model: string, modelFallbacks: string[] = []) {
	return {
		meta: {},
		model,
		routingDiagnostics: { dynamicRoute: { action: { modelFallbacks } } },
	};
}

describe("dynamic route model fallbacks", () => {
	beforeEach(() => {
		beforeRequestMock.mockReset();
		runnerMock.mockReset();
	});

	it("reruns the full pipeline with the next model after a retryable failure", async () => {
		beforeRequestMock
			.mockResolvedValueOnce({ ok: true, ctx: context("primary/model", ["fallback/model"]) })
			.mockResolvedValueOnce({ ok: true, ctx: context("fallback/model") });
		runnerMock
			.mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
			.mockResolvedValueOnce(new Response("ok", { status: 200 }));

		const response = await makeEndpointHandler({ endpoint: "responses", schema: null })(new Request("https://api.phaseo.app/v1/responses", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ model: "request/model", input: "hello" }),
		}));

		expect(response.status).toBe(200);
		expect(runnerMock).toHaveBeenCalledTimes(2);
		expect(beforeRequestMock).toHaveBeenCalledTimes(2);
		expect(beforeRequestMock.mock.calls[1]?.[4]).toEqual({ dynamicRouteModelOverride: "fallback/model" });
	});

	it("does not switch models for a non-retryable client error", async () => {
		beforeRequestMock.mockResolvedValueOnce({ ok: true, ctx: context("primary/model", ["fallback/model"]) });
		runnerMock.mockResolvedValueOnce(new Response("invalid", { status: 400 }));

		const response = await makeEndpointHandler({ endpoint: "responses", schema: null })(new Request("https://api.phaseo.app/v1/responses", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ model: "request/model", input: "hello" }),
		}));

		expect(response.status).toBe(400);
		expect(runnerMock).toHaveBeenCalledTimes(1);
		expect(beforeRequestMock).toHaveBeenCalledTimes(1);
	});
});
