import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { execute } from "./index";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

describe("Cloudflare image generation executor", () => {
	it("maps image requests to the native run endpoint and unwraps base64 output", async () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({ CLOUDFLARE_ACCOUNT_ID: "account-123", CLOUDFLARE_API_TOKEN: "token-123" } as any);
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/ai/run/@cf/black-forest-labs/flux-1-schnell"),
			response: jsonResponse({ success: true, result: { image: "aW1hZ2U=" } }),
		}]);
		const result = await execute({
			ir: { model: "black-forest-labs/flux-1-schnell", prompt: "cloud", size: "1024x768" },
			requestId: "req-image",
			workspaceId: "workspace",
			providerId: "cloudflare",
			providerModelSlug: "@cf/black-forest-labs/flux-1-schnell",
			endpoint: "images.generations",
			byokMeta: [],
			pricingCard: { rules: [] },
			meta: { returnUpstreamRequest: true },
		} as ExecutorExecuteArgs);
		expect(mock.calls[0]?.bodyJson).toMatchObject({ prompt: "cloud", width: 1024, height: 768 });
		expect(result.kind).toBe("completed");
		if (result.kind === "completed") expect((result.ir as any)?.data[0].b64Json).toBe("aW1hZ2U=");
		mock.restore();
	});
});
