import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveOpenAICompatConfig } from "../config";
import {
	setupRuntimeFromEnv,
	setupTestRuntime,
	teardownTestRuntime,
} from "../../../../tests/helpers/runtime";

beforeAll(() => {
	setupTestRuntime();
});

afterAll(() => {
	teardownTestRuntime();
});

describe("resolveOpenAICompatConfig errors", () => {
	it("throws a coded error when provider base URL configuration is missing", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({ LIQUID_API_KEY: "test-liquid-key", LIQUID_BASE_URL: "" } as any);

		expect(() => resolveOpenAICompatConfig("liquid")).toThrowError(
			"liquid_base_url_missing",
		);
		try {
			resolveOpenAICompatConfig("liquid");
		} catch (error) {
			expect((error as any)?.code).toBe("liquid_base_url_missing");
		}
	});
});
