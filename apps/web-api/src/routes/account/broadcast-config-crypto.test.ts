import { describe, expect, it } from "vitest";
import type { Env } from "@/env";
import { decryptBroadcastConfig, encryptBroadcastConfig } from "./broadcast-config-crypto";

describe("Broadcast config encryption", () => {
	const env = {
		ASYNC_WEBHOOK_SECRET_ENCRYPTION_KEY: "test-broadcast-encryption-key",
		ASYNC_WEBHOOK_SECRET_ENCRYPTION_KEY_VERSION: "test-v1",
	} as Env;

	it("round-trips destination credentials without plaintext persistence", async () => {
		const config = { url: "https://hooks.example.com/traces", headers_json: "{\"Authorization\":\"Bearer secret\"}" };
		const encrypted = await encryptBroadcastConfig(env, config);
		expect(encrypted.ciphertext).not.toContain("Bearer secret");
		expect(encrypted.keyVersion).toBe("test-v1");
		await expect(decryptBroadcastConfig(env, {
			destination_config_ciphertext: encrypted.ciphertext,
			destination_config_iv: encrypted.iv,
			destination_config_key_version: encrypted.keyVersion,
		})).resolves.toEqual(config);
	});

	it("supports legacy plaintext rows during migration", async () => {
		await expect(decryptBroadcastConfig(env, {
			destination_config: { url: "https://legacy.example.com/traces" },
		})).resolves.toEqual({ url: "https://legacy.example.com/traces" });
	});
});
