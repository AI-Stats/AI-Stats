import { describe, expect, it } from "vitest";
import type { Env } from "@/env";
import { encryptByokSecret } from "./settings-byok";

function fromByteaHex(value: string): Uint8Array {
	const hex = value.replace(/^\\x/, "");
	return Uint8Array.from(hex.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}

function exactBuffer(bytes: Uint8Array): ArrayBuffer {
	return Uint8Array.from(bytes).buffer;
}

describe("encryptByokSecret", () => {
	it("binds ciphertext to its workspace, provider, and key version", async () => {
		const rawKey = crypto.getRandomValues(new Uint8Array(32));
		const env = {
			BYOK_ACTIVE_KEY_VERSION: "1",
			BYOK_KMS_KEY_V1: Buffer.from(rawKey).toString("base64"),
		} as Env;
		const encrypted = await encryptByokSecret(env, "sk-example-secret-value", {
			workspaceId: "workspace-1",
			providerId: "openai",
		});
		const key = await crypto.subtle.importKey("raw", exactBuffer(rawKey), "AES-GCM", false, ["decrypt"]);
		const ciphertext = fromByteaHex(encrypted.enc_value);
		const tag = fromByteaHex(encrypted.enc_tag);
		const combined = new Uint8Array(ciphertext.length + tag.length);
		combined.set(ciphertext);
		combined.set(tag, ciphertext.length);
		const decrypt = (workspaceId: string) => crypto.subtle.decrypt({
			name: "AES-GCM",
			iv: exactBuffer(fromByteaHex(encrypted.enc_iv)),
			additionalData: exactBuffer(new TextEncoder().encode(`${workspaceId}|openai|v1`)),
		}, key, exactBuffer(combined));

		expect(encrypted.enc_aad_version).toBe(1);
		expect(new TextDecoder().decode(await decrypt("workspace-1"))).toBe("sk-example-secret-value");
		await expect(decrypt("workspace-2")).rejects.toBeDefined();
	});
});
