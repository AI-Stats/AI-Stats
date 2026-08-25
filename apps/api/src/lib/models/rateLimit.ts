import { getBindings } from "@/runtime/env";

const ANONYMOUS_MODELS_BUCKET = "anonymous-models";

async function digestKey(value: string): Promise<string> {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function checkAnonymousModelsRateLimit(req: Request): Promise<boolean> {
	try {
		const bindings = getBindings();
		const production = String(bindings.ENV ?? "").trim().toLowerCase() === "prod";
		const limiter = bindings.OAUTH_TOKEN_RATE_LIMITER;
		if (!limiter) return !production;

		const clientAddress =
			req.headers.get("cf-connecting-ip")?.trim() ||
			req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
			"unknown";
		const key = await digestKey(`${ANONYMOUS_MODELS_BUCKET}:${clientAddress}`);
		return (await limiter.limit({ key })).success;
	} catch (error) {
		console.error("Anonymous models rate limiter unavailable", error);
		return true;
	}
}
