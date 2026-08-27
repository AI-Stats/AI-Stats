import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { execute } from "./index";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

describe("Cloudflare transcription executor", () => {
	it("posts audio bytes to the native run endpoint and unwraps transcription output", async () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({ CLOUDFLARE_ACCOUNT_ID: "account-123", CLOUDFLARE_API_TOKEN: "token-123" } as any);
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/ai/run/@cf/openai/whisper"),
			response: jsonResponse({ success: true, result: { text: "hello", language: "en" } }),
		}]);
		const result = await execute({
			ir: { model: "openai/whisper-1", file: new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" }) },
			requestId: "req-audio",
			workspaceId: "workspace",
			providerId: "cloudflare",
			providerModelSlug: "@cf/openai/whisper",
			endpoint: "audio.transcription",
			byokMeta: [],
			pricingCard: { rules: [] },
			meta: {},
		} as ExecutorExecuteArgs);
		expect(mock.calls).toHaveLength(1);
		expect(result.kind).toBe("completed");
		if (result.kind === "completed") expect(result.ir).toMatchObject({ text: "hello", language: "en" });
		mock.restore();
	});

	it("maps Whisper Turbo JSON fields and detected language", async () => {
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/ai/run/@cf/openai/whisper-large-v3-turbo"),
			response: jsonResponse({ success: true, result: { text: "bonjour", transcription_info: { language: "fr" } } }),
		}]);
		const result = await execute({
			ir: { model: "openai/whisper-large-v3-turbo", file: new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" }), language: "fr", prompt: "names" },
			requestId: "req-turbo",
			workspaceId: "workspace",
			providerId: "cloudflare",
			providerModelSlug: "@cf/openai/whisper-large-v3-turbo",
			endpoint: "audio.transcription",
			byokMeta: [],
			pricingCard: { rules: [] },
			meta: {},
		} as ExecutorExecuteArgs);
		expect(mock.calls[0]?.bodyJson).toMatchObject({ audio: "AQID", language: "fr", initial_prompt: "names" });
		if (result.kind === "completed") expect(result.ir).toMatchObject({ text: "bonjour", language: "fr" });
		mock.restore();
	});
});
