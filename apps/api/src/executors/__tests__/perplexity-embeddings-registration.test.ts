import { describe, expect, it } from "vitest";
import { isProviderCapabilityEnabled, resolveProviderExecutor } from "../index";

describe("Perplexity embeddings registration", () => {
	it("registers the verified standard embeddings executor", () => {
		expect(resolveProviderExecutor("perplexity", "embeddings")).toBeTruthy();
		expect(isProviderCapabilityEnabled("perplexity", "embeddings")).toBe(true);
	});
});
