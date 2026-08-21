import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupRuntimeFromEnv, setupTestRuntime, teardownTestRuntime } from "../../../tests/helpers/runtime";
import { arrayBufferToBase64, cloudflareRunUrl, unwrapCloudflareResult } from "./shared";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

describe("Cloudflare native Workers AI helpers", () => {
	it("builds an account-scoped model run URL without escaping the model path", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({ CLOUDFLARE_ACCOUNT_ID: "account-123" } as any);
		expect(cloudflareRunUrl("@cf/openai/whisper")).toBe(
			"https://api.cloudflare.com/client/v4/accounts/account-123/ai/run/@cf/openai/whisper",
		);
	});

	it("unwraps Cloudflare API envelopes and encodes binary output", () => {
		expect(unwrapCloudflareResult({ success: true, result: { text: "hello" } })).toEqual({ text: "hello" });
		expect(arrayBufferToBase64(new Uint8Array([1, 2, 3]).buffer)).toBe("AQID");
	});
});
