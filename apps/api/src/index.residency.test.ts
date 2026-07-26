import { describe, expect, it } from "vitest";
import worker from "./index";

const executionContext = {
	waitUntil: () => undefined,
	passThroughOnException: () => undefined,
	props: {},
} as unknown as ExecutionContext;

describe("EU content-path ingress", () => {
	it("returns 503 when the regional hostname is not activated", async () => {
		const response = await worker.fetch(
			new Request("https://eu.api.phaseo.app/not-found"),
			{} as never,
			executionContext,
		);

		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({
			error: "regional_content_path_unavailable",
		});
	});

	it("labels responses after the regional hostname is activated", async () => {
		const response = await worker.fetch(
			new Request("https://eu.api.phaseo.app/not-found"),
			{ EU_CONTENT_PATH_ENABLED: "true" } as never,
			executionContext,
		);

		expect(response.status).toBe(404);
		expect(response.headers.get("x-phaseo-residency-level")).toBe("content-path");
		expect(response.headers.get("x-phaseo-processing-region")).toBe("eu");
	});

	it("does not label the ordinary global hostname", async () => {
		const response = await worker.fetch(
			new Request("https://api.phaseo.app/not-found"),
			{} as never,
			executionContext,
		);

		expect(response.status).toBe(404);
		expect(response.headers.get("x-phaseo-residency-level")).toBeNull();
	});
});
