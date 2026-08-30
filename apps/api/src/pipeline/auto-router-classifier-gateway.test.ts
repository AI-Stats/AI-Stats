import { describe, expect, it, vi } from "vitest";
import { AUTO_ROUTER_CLASSIFIER_MODEL_ID } from "./before/auto-router";
import { runAutoRouterClassifierGatewayRequest } from "./auto-router-classifier-gateway";

describe("auto-router classifier gateway request", () => {
	it("runs an authenticated request through the gateway", async () => {
		const handler = vi.fn(async () => new Response(JSON.stringify({
			output_text: JSON.stringify({
				primary_workload: "code",
				workloads: [{ workload: "code", weight: 0.8 }, { workload: "reasoning", weight: 0.2 }],
				complexity: 0.72,
				confidence: 0.91,
			}),
		}), { status: 200, headers: { "content-type": "application/json" } }));
		const sourceRequest = new Request("https://api.phaseo.app/v1/responses", {
			headers: { Authorization: "Bearer phaseo_test_key" },
		});

		const result = await runAutoRouterClassifierGatewayRequest({
			sourceRequest,
			endpoint: "responses",
			body: { model: "phaseo/auto", input: "Refactor this parser and prove it is correct" },
			handler,
		});

		expect(result).toMatchObject({ primaryWorkload: "code", complexity: 0.72, confidence: 0.91, source: "llm" });
		expect(handler).toHaveBeenCalledOnce();
		const childRequest = handler.mock.calls[0]?.[0];
		expect(childRequest?.headers.get("authorization")).toBe("Bearer phaseo_test_key");
		expect(childRequest?.headers.has("x-phaseo-metadata")).toBe(false);
		const childBody = await childRequest?.json() as any;
		expect(childBody.model).toBe(AUTO_ROUTER_CLASSIFIER_MODEL_ID);
		expect(childBody.input[1].content[0].text).toContain("Refactor this parser");
	});

	it("fails open when the child request cannot be classified", async () => {
		const result = await runAutoRouterClassifierGatewayRequest({
			sourceRequest: new Request("https://api.phaseo.app/v1/responses", { headers: { Authorization: "Bearer key" } }),
			endpoint: "responses",
			body: { input: "hello" },
			handler: async () => new Response("unavailable", { status: 503 }),
		});
		expect(result).toBeNull();
	});
});
