import { getBindings } from "@/runtime/env";

function base64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function buffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function key(value: string): Promise<CryptoKey> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt"]);
}

export async function encryptBroadcastConfig(config: Record<string, string>) {
	const bindings = getBindings();
	const material = bindings.ASYNC_WEBHOOK_SECRET_ENCRYPTION_KEY?.trim();
	if (!material) throw new Error("Broadcast credential encryption is not configured");
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv: buffer(iv) },
		await key(material),
		new TextEncoder().encode(JSON.stringify(config)),
	);
	return {
		ciphertext: base64(new Uint8Array(ciphertext)),
		iv: base64(iv),
		keyVersion: bindings.ASYNC_WEBHOOK_SECRET_ENCRYPTION_KEY_VERSION?.trim() || "v1",
	};
}
