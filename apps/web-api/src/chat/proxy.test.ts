import { describe, expect, it } from "vitest";
import { deriveChatGatewayKey, resolveGatewayBaseUrlForEnvironment } from "@/chat/proxy";

describe("deriveChatGatewayKey", () => {
	it("creates a stable, distinct managed key for each user in a workspace", async () => {
		const first = await deriveChatGatewayKey("seed", "workspace-1", "user-1");
		const repeat = await deriveChatGatewayKey("seed", "workspace-1", "user-1");
		const second = await deriveChatGatewayKey("seed", "workspace-1", "user-2");

		expect(first).toEqual(repeat);
		expect(first).not.toEqual(second);
		expect(first.kid).toHaveLength(12);
		expect(first.secret).toHaveLength(40);
	});
});

describe("resolveGatewayBaseUrlForEnvironment", () => {
	it("allows only the configured staging gateway in production", () => {
		expect(resolveGatewayBaseUrlForEnvironment({ configuredBaseUrl: "https://api.phaseo.app/v1", stagingBaseUrl: "https://api-staging.phaseo.app/v1", requestedBaseUrl: "https://api-staging.phaseo.app/v1", environment: "production" })).toBe("https://api-staging.phaseo.app/v1");
		expect(resolveGatewayBaseUrlForEnvironment({ configuredBaseUrl: "https://api.phaseo.app/v1", stagingBaseUrl: "https://api-staging.phaseo.app/v1", requestedBaseUrl: "https://attacker.example.com/v1", environment: "production" })).toBe("https://api.phaseo.app/v1");
	});

	it("uses only the configured gateway in production", () => {
		expect(resolveGatewayBaseUrlForEnvironment({ configuredBaseUrl: "https://private-gateway.example.com", requestedBaseUrl: "https://api.phaseo.app/v1", environment: "production" })).toBe("https://private-gateway.example.com/v1");
		expect(resolveGatewayBaseUrlForEnvironment({ configuredBaseUrl: "https://private-gateway.example.com", requestedBaseUrl: "http://127.0.0.1:8787/v1", environment: "production" })).toBe("https://private-gateway.example.com/v1");
		expect(resolveGatewayBaseUrlForEnvironment({ configuredBaseUrl: "https://private-gateway.example.com", requestedBaseUrl: "https://attacker.example.com/v1", environment: "production" })).toBe("https://private-gateway.example.com/v1");
	});

	it("fails closed in production when the gateway is not configured", () => {
		expect(resolveGatewayBaseUrlForEnvironment({ requestedBaseUrl: "https://api.phaseo.app/v1", environment: "production" })).toBeNull();
	});

	it("allows only explicit public, configured, and localhost targets outside production", () => {
		expect(resolveGatewayBaseUrlForEnvironment({ configuredBaseUrl: "https://private-gateway.example.com", requestedBaseUrl: "https://api.phaseo.app/v1", environment: "development" })).toBe("https://api.phaseo.app/v1");
		expect(resolveGatewayBaseUrlForEnvironment({ configuredBaseUrl: "https://private-gateway.example.com", requestedBaseUrl: "http://localhost:8787", environment: "development" })).toBe("http://localhost:8787/v1");
		expect(resolveGatewayBaseUrlForEnvironment({ configuredBaseUrl: "https://private-gateway.example.com", requestedBaseUrl: "https://attacker.example.com/v1", environment: "development" })).toBe("https://private-gateway.example.com/v1");
	});

	it("defaults staging traffic to the configured staging gateway", () => {
		expect(resolveGatewayBaseUrlForEnvironment({ stagingBaseUrl: "https://api-staging.phaseo.app", environment: "staging" })).toBe("https://api-staging.phaseo.app/v1");
	});
});
