import type { Env } from "@/env";

type EncryptedBroadcastConfig = {
	ciphertext: string;
	iv: string;
	keyVersion: string;
};

function base64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
	return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function buffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function material(env: Env): { value: string; version: string } {
	const value = env.ASYNC_WEBHOOK_SECRET_ENCRYPTION_KEY?.trim() ?? env.WEBHOOK_SECRET_ENCRYPTION_KEY?.trim();
	if (!value) throw new Error("Broadcast credential encryption is not configured");
	return { value, version: env.ASYNC_WEBHOOK_SECRET_ENCRYPTION_KEY_VERSION?.trim() || "v1" };
}

async function key(value: string): Promise<CryptoKey> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptBroadcastConfig(env: Env, config: Record<string, string>): Promise<EncryptedBroadcastConfig> {
	const active = material(env);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		await key(active.value),
		new TextEncoder().encode(JSON.stringify(config)),
	);
	return { ciphertext: base64(new Uint8Array(ciphertext)), iv: base64(iv), keyVersion: active.version };
}

export async function decryptBroadcastConfig(env: Env, row: Record<string, unknown>): Promise<Record<string, any>> {
	const ciphertext = String(row.destinationConfigCiphertext ?? row.destination_config_ciphertext ?? "").trim();
	const iv = String(row.destinationConfigIv ?? row.destination_config_iv ?? "").trim();
	if (!ciphertext || !iv) {
		const legacy = row.destinationConfig ?? row.destination_config;
		return legacy && typeof legacy === "object" && !Array.isArray(legacy) ? legacy as Record<string, any> : {};
	}
	const candidates = [
		{ value: env.ASYNC_WEBHOOK_SECRET_ENCRYPTION_KEY, version: env.ASYNC_WEBHOOK_SECRET_ENCRYPTION_KEY_VERSION ?? "v1" },
		{ value: env.ASYNC_WEBHOOK_SECRET_ENCRYPTION_KEY_PREVIOUS, version: env.ASYNC_WEBHOOK_SECRET_ENCRYPTION_KEY_PREVIOUS_VERSION ?? "previous" },
		{ value: env.WEBHOOK_SECRET_ENCRYPTION_KEY, version: "v1" },
	].filter((candidate): candidate is { value: string; version: string } => Boolean(candidate.value?.trim()));
	const preferred = String(row.destinationConfigKeyVersion ?? row.destination_config_key_version ?? "").trim();
	candidates.sort((left, right) => Number(right.version === preferred) - Number(left.version === preferred));
	for (const candidate of candidates) {
		try {
			const plaintext = await crypto.subtle.decrypt(
				{ name: "AES-GCM", iv: buffer(fromBase64(iv)) },
				await key(candidate.value),
				buffer(fromBase64(ciphertext)),
			);
			const parsed = JSON.parse(new TextDecoder().decode(plaintext));
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
		} catch {}
	}
	throw new Error("Broadcast credentials could not be decrypted");
}
