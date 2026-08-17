import { describe, expect, it } from "vitest";

import { gatewayStaticContextCacheKey } from "./context";

const shared = {
	testingModeCacheSegment: "default" as const,
	workspaceId: "workspace_1",
	versionToken: "v1",
	endpoint: "chat.completions",
};

describe("gatewayStaticContextCacheKey", () => {
	it("isolates preset cache entries by API key", () => {
		const ownerKey = gatewayStaticContextCacheKey({
			...shared,
			apiKeyId: "key_owner",
			model: "@private-preset",
		});
		const otherKey = gatewayStaticContextCacheKey({
			...shared,
			apiKeyId: "key_other",
			model: "@private-preset",
		});

		expect(ownerKey).not.toBe(otherKey);
	});

	it("invalidates preset cache entries when an API key version changes", () => {
		const currentKey = gatewayStaticContextCacheKey({
			...shared,
			apiKeyId: "key_owner",
			model: "@private-preset",
		});
		const rotatedKey = gatewayStaticContextCacheKey({
			...shared,
			apiKeyId: "key_owner",
			versionToken: "v2",
			model: "@private-preset",
		});

		expect(currentKey).not.toBe(rotatedKey);
	});

	it("continues sharing non-preset static metadata within a workspace", () => {
		const firstKey = gatewayStaticContextCacheKey({
			...shared,
			apiKeyId: "key_1",
			model: "openai/gpt-5.4",
		});
		const secondKey = gatewayStaticContextCacheKey({
			...shared,
			apiKeyId: "key_2",
			versionToken: "v2",
			model: "openai/gpt-5.4",
		});

		expect(firstKey).toBe(secondKey);
	});
});
