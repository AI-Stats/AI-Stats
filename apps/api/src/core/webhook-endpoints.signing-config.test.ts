import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findWebhookEndpointMock = vi.hoisted(() => vi.fn());

vi.mock("@/runtime/env", () => ({
		getBindings: () => ({
			ASYNC_WEBHOOK_SECRET_ENCRYPTION_KEY: "test-webhook-encryption-key",
			ASYNC_WEBHOOK_SECRET_ENCRYPTION_KEY_VERSION: "test-v1",
		}),
}));

vi.mock("@/repositories/webhook-endpoints", () => ({
	findWebhookEndpoint: (...args: unknown[]) => findWebhookEndpointMock(...args),
}));

import { getWebhookEndpointSigningConfig } from "./webhook-endpoints";

describe("getWebhookEndpointSigningConfig", () => {
	beforeEach(() => {
		findWebhookEndpointMock.mockReset();
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns null when encrypted secret columns are missing", async () => {
		findWebhookEndpointMock.mockResolvedValue({
				id: "we_1",
				workspace_id: "ws_1",
				url: "https://receiver.test/webhook",
				status: "active",
				events: ["batch.completed"],
				secret_ciphertext: "",
				secret_iv: null,
				secret_key_version: "test-v1",
		});

		await expect(
			getWebhookEndpointSigningConfig({ workspaceId: "ws_1", endpointId: "we_1" }),
		).resolves.toBeNull();
		expect(findWebhookEndpointMock).toHaveBeenCalledWith("ws_1", "we_1");
		expect(console.warn).toHaveBeenCalledWith("webhook_endpoint_missing_secret_material", {
			workspaceId: "ws_1",
			endpointId: "we_1",
		});
	});

	it("returns null when encrypted secret material cannot be decrypted", async () => {
		findWebhookEndpointMock.mockResolvedValue({
				id: "we_1",
				workspace_id: "ws_1",
				url: "https://receiver.test/webhook",
				status: "active",
				events: ["batch.completed"],
				secret_ciphertext: "not-valid-base64",
				secret_iv: "not-valid-base64",
				secret_key_version: "test-v1",
		});

		await expect(
			getWebhookEndpointSigningConfig({ workspaceId: "ws_1", endpointId: "we_1" }),
		).resolves.toBeNull();
		expect(console.warn).toHaveBeenCalledWith("webhook_endpoint_secret_decryption_failed", {
			workspaceId: "ws_1",
			endpointId: "we_1",
		});
	});
});
