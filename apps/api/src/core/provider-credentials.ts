import { getBindings, getByokKey } from "@/runtime/env";

const MAX_SCOPE_ITEMS = 256;
const FINGERPRINT_PBKDF2_ITERATIONS = 100_000;

function decodeBase64(value: string): Uint8Array {
	const raw = value.trim().replace(/^base64:/, "").replace(/-/g, "+").replace(/_/g, "/");
	const padded = raw.padEnd(Math.ceil(raw.length / 4) * 4, "=");
	const binary = atob(padded);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function fingerprintSalt(value: string | undefined, fallback: Uint8Array): Uint8Array {
	if (!value) return fallback;
	return value.startsWith("base64:") ? decodeBase64(value) : new TextEncoder().encode(value);
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.slice().buffer as ArrayBuffer;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalProviderId(value: unknown): string {
	const providerId = String(value ?? "").trim().toLowerCase();
	return providerId === "x-ai" || providerId === "xai" ? "spacex-ai" : providerId;
}

export function normalizeCredentialScope(value: unknown, field: string): string[] | null {
	if (value === null || value === undefined) return null;
	if (!Array.isArray(value)) throw new Error(`${field} must be a list`);
	const values = Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)));
	if (values.length > MAX_SCOPE_ITEMS) throw new Error(`${field} can contain up to ${MAX_SCOPE_ITEMS} items`);
	return values;
}

export function validateProviderCredential(providerId: string, rawValue: unknown): { value: string; strict: boolean } {
	const value = String(rawValue ?? "").trim();
	if (!value) throw new Error("key is required");
	const patterns: Record<string, RegExp> = {
		anthropic: /^sk-ant-[A-Za-z0-9_-]{16,}$/,
		openai: /^sk-[A-Za-z0-9_-]{16,}$/,
		deepseek: /^sk-[A-Za-z0-9_-]{16,}$/,
		alibaba: /^sk-[A-Za-z0-9_-]{16,}$/,
		mistral: /^sk-[A-Za-z0-9_-]{16,}$/,
		moonshotai: /^sk-[A-Za-z0-9_-]{16,}$/,
		groq: /^gsk_[A-Za-z0-9_-]{16,}$/,
		"google-ai-studio": /^AIza[0-9A-Za-z_-]{20,}$/,
	};
	const pattern = patterns[providerId];
	if (pattern && !pattern.test(value)) throw new Error("key format is invalid for this provider");
	if (["google-vertex", "cloudflare", "azure"].includes(providerId)) {
		let parsed: Record<string, unknown>;
		try { parsed = JSON.parse(value) as Record<string, unknown>; } catch { throw new Error("valid JSON credentials are required for this provider"); }
		if (providerId === "google-vertex" && !(parsed.type === "service_account" && parsed.client_email && parsed.private_key)) throw new Error("Google service-account credentials are incomplete");
		if (providerId === "cloudflare" && !(parsed.apiToken && parsed.accountId)) throw new Error("Cloudflare credentials require apiToken and accountId");
		if (providerId === "azure" && !(Array.isArray(parsed.deployments) && parsed.deployments.length)) throw new Error("Azure credentials require at least one deployment mapping");
		return { value, strict: true };
	}
	if (providerId === "amazon-bedrock" && value.startsWith("{")) {
		let parsed: Record<string, unknown>;
		try { parsed = JSON.parse(value) as Record<string, unknown>; } catch { throw new Error("Amazon Bedrock credentials JSON is invalid"); }
		if (!(parsed.accessKeyId && parsed.secretAccessKey && (parsed.region || parsed.awsRegion))) throw new Error("Amazon Bedrock credentials are incomplete");
		return { value, strict: true };
	}
	if (!value.startsWith("{") && /\s/.test(value)) throw new Error("key must not contain spaces or line breaks");
	if (!pattern && value.length < 16) throw new Error("key must be at least 16 characters");
	return { value, strict: Boolean(pattern) };
}

export async function encryptProviderCredential(args: { plaintext: string; workspaceId: string; providerId: string }) {
	const bindings = getBindings();
	const version = Number(bindings.BYOK_ACTIVE_KEY_VERSION ?? "1") || 1;
	const keyBytes = decodeBase64(getByokKey(version));
	if (keyBytes.length !== 32) throw new Error("BYOK master key must be 32 bytes");
	const key = await crypto.subtle.importKey("raw", arrayBuffer(keyBytes), "AES-GCM", false, ["encrypt"]);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const additionalData = new TextEncoder().encode(`${args.workspaceId}|${args.providerId}|v${version}`);
	const encrypted = new Uint8Array(await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv: arrayBuffer(iv), additionalData: arrayBuffer(additionalData), tagLength: 128 },
		key,
		new TextEncoder().encode(args.plaintext),
	));
	const ciphertext = encrypted.slice(0, -16);
	const tag = encrypted.slice(-16);
	const fingerprintMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(args.plaintext), "PBKDF2", false, ["deriveBits"]);
	const fingerprint = await crypto.subtle.deriveBits({
		name: "PBKDF2",
		hash: "SHA-256",
		iterations: FINGERPRINT_PBKDF2_ITERATIONS,
		salt: arrayBuffer(fingerprintSalt(bindings.BYOK_FINGERPRINT_PEPPER, keyBytes)),
	}, fingerprintMaterial, 256);
	return {
		enc_value: `\\x${bytesToHex(ciphertext)}`,
		enc_iv: `\\x${bytesToHex(iv)}`,
		enc_tag: `\\x${bytesToHex(tag)}`,
		key_version: version,
		fingerprint_sha256: bytesToHex(new Uint8Array(fingerprint)),
		prefix: args.plaintext.slice(0, 6),
		suffix: args.plaintext.slice(-4),
	};
}
