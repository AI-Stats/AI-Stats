// Purpose: Shared OAuth route helper utilities.

import {
	DEFAULT_MANAGEMENT_KEY_CAPABILITIES,
	normalizeScopeList,
	serializeScopeList,
} from "@/lib/authz/capabilities";
export const BASE62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const INFERENCE_KEY_PREFIX = "phaseo_v1_sk_";
export const MANAGEMENT_KEY_PREFIX = "phaseo_v1_mk_";
// Kept as an alias while consumers migrate to the explicit inference name.
export const KEY_PREFIX = INFERENCE_KEY_PREFIX;
export const encoder = new TextEncoder();

export function randomBase62(length: number): string {
	const unbiasedLimit = Math.floor(256 / BASE62.length) * BASE62.length;
	let out = "";
	while (out.length < length) {
		const bytes = crypto.getRandomValues(new Uint8Array(length));
		for (let i = 0; i < bytes.length && out.length < length; i++) {
			const value = bytes[i];
			if (value >= unbiasedLimit) continue;
			out += BASE62[value % BASE62.length];
		}
	}
	return out;
}

function generateKey(tokenPrefix: string) {
	const kid = randomBase62(12);
	const secret = randomBase62(40);
	const plaintext = `${tokenPrefix}${kid}_${secret}`;
	const prefix = kid.slice(0, 6);
	return { kid, secret, plaintext, prefix };
}

export function generateGatewayKey() {
	return generateKey(INFERENCE_KEY_PREFIX);
}

export function generateManagementKey() {
	return generateKey(MANAGEMENT_KEY_PREFIX);
}

export async function hmacSecret(secret: string, pepper: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(pepper),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(secret));
	const bytes = new Uint8Array(signature);
	let hex = "";
	for (let i = 0; i < bytes.length; i++) {
		hex += bytes[i].toString(16).padStart(2, "0");
	}
	return hex;
}

export function normalizeScopeInput(scopes: unknown): { ok: true; value: string } | { ok: false; message: string } {
	const normalized = normalizeScopeList(scopes, {
		allowIdentityScopes: false,
		defaultScopes: DEFAULT_MANAGEMENT_KEY_CAPABILITIES,
	});
	if (normalized.ok === false) {
		return { ok: false, message: normalized.message };
	}
	return { ok: true, value: serializeScopeList(normalized.value) };
}

export function timingSafeEqual(a: string, b: string): boolean {
	const len = Math.max(a.length, b.length);
	let diff = a.length === b.length ? 0 : 1;
	for (let i = 0; i < len; i++) {
		const ca = i < a.length ? a.charCodeAt(i) : 0;
		const cb = i < b.length ? b.charCodeAt(i) : 0;
		diff |= ca ^ cb;
	}
	return diff === 0;
}
