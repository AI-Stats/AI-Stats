import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	openAICompatHeaders,
	openAICompatUrl,
	resolveOpenAICompatRoute,
} from "../openai-compatible/config";
import {
	setupRuntimeFromEnv,
	setupTestRuntime,
	teardownTestRuntime,
} from "../../../tests/helpers/runtime";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

describe("Cloudflare Workers AI configuration", () => {
	it("builds the official account-scoped OpenAI-compatible endpoint", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({
			CLOUDFLARE_ACCOUNT_ID: "account-123",
			CLOUDFLARE_API_TOKEN: "token-123",
		} as any);

		expect(openAICompatUrl("cloudflare", "/chat/completions")).toBe(
			"https://api.cloudflare.com/client/v4/accounts/account-123/ai/v1/chat/completions",
		);
		expect(openAICompatHeaders("cloudflare", "token-123")).toMatchObject({
			Authorization: "Bearer token-123",
			"cf-aig-gateway-id": "default",
			"Content-Type": "application/json",
		});
	});

	it("uses an explicitly configured AI Gateway ID", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({
			CLOUDFLARE_AI_GATEWAY_ID: "phaseo-production",
		} as any);

		expect(openAICompatHeaders("cloudflare", "token-123")).toMatchObject({
			"cf-aig-gateway-id": "phaseo-production",
		});
	});

	it("prefers an explicit AI Gateway or custom Workers AI base URL", () => {
		teardownTestRuntime();
		setupRuntimeFromEnv({
			CLOUDFLARE_ACCOUNT_ID: "account-123",
			CLOUDFLARE_AI_GATEWAY_BASE_URL: "https://gateway.example/ai/v1",
		} as any);
		expect(openAICompatUrl("cloudflare", "/chat/completions")).toBe(
			"https://gateway.example/ai/v1/chat/completions",
		);
	});

	it("uses Responses only for Workers AI GPT-OSS models", () => {
		expect(resolveOpenAICompatRoute("cloudflare", "@cf/openai/gpt-oss-120b")).toBe("responses");
		expect(resolveOpenAICompatRoute("cloudflare", "@cf/openai/gpt-oss-20b")).toBe("responses");
		expect(resolveOpenAICompatRoute("cloudflare", "@cf/moonshotai/kimi-k2.6")).toBe("chat");
	});
});
