import { Hono } from "hono";
import type { Env } from "@/env";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_FILE_BYTES + 1024 * 1024;

type ProvenanceResult = {
	type: "c2pa" | "synthid" | string;
	outcome: "detected" | "not_detected" | string;
	validation_state?: string | null;
	issuer?: string | null;
	model?: string | null;
	generated_at?: string | null;
};

type ProvenanceResponse = {
	object: "content_provenance_check";
	created_at: number;
	results: ProvenanceResult[];
};

function noStoreHeaders() {
	return { "Cache-Control": "no-store" };
}

function isSupportedMedia(file: File): boolean {
	const mediaType = file.type.trim().toLowerCase();
	return mediaType.startsWith("image/") || mediaType.startsWith("audio/");
}

function safeFilename(filename: string): string {
	const normalized = filename.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
	return normalized.slice(0, 120) || "upload";
}

async function hashRateLimitKey(request: Request): Promise<string> {
	const address = request.headers.get("cf-connecting-ip") ?? "unknown";
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(`content-provenance:${address}`),
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

function isProvenanceResponse(value: unknown): value is ProvenanceResponse {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<ProvenanceResponse>;
	return candidate.object === "content_provenance_check"
		&& typeof candidate.created_at === "number"
		&& Array.isArray(candidate.results);
}

export const publicToolsRouter = new Hono<{ Bindings: Env }>();

publicToolsRouter.post("/tools/content-provenance", async (c) => {
	const contentLength = Number(c.req.header("content-length") ?? 0);
	if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
		return c.json({ error: "file_too_large", message: "Choose a file no larger than 20 MB." }, 413, noStoreHeaders());
	}

	try {
		const limiter = c.env.CONTENT_PROVENANCE_RATE_LIMITER;
		if (!limiter && c.env.ENV === "production") {
			return c.json({ error: "service_unavailable", message: "Verification is temporarily unavailable." }, 503, noStoreHeaders());
		}
		if (limiter) {
			const limited = !(await limiter.limit({ key: await hashRateLimitKey(c.req.raw) })).success;
			if (limited) {
				return c.json({ error: "rate_limited", message: "Too many checks. Try again in a minute." }, 429, {
					...noStoreHeaders(),
					"Retry-After": "60",
				});
			}
		}
	} catch (error) {
		console.error("[web-api/content-provenance] rate limiter unavailable", error);
		return c.json({ error: "service_unavailable", message: "Verification is temporarily unavailable." }, 503, noStoreHeaders());
	}

	if (!c.env.OPENAI_API_KEY) {
		console.error("[web-api/content-provenance] OPENAI_API_KEY is not configured");
		return c.json({ error: "service_unavailable", message: "Verification is temporarily unavailable." }, 503, noStoreHeaders());
	}

	let formData: FormData;
	try {
		formData = await c.req.formData();
	} catch {
		return c.json({ error: "invalid_upload", message: "Upload a valid image or audio file." }, 400, noStoreHeaders());
	}

	const upload = formData.get("file");
	if (!(upload instanceof File) || upload.size === 0) {
		return c.json({ error: "file_required", message: "Choose an image or audio file." }, 400, noStoreHeaders());
	}
	if (upload.size > MAX_FILE_BYTES) {
		return c.json({ error: "file_too_large", message: "Choose a file no larger than 20 MB." }, 413, noStoreHeaders());
	}
	if (!isSupportedMedia(upload)) {
		return c.json({ error: "unsupported_file", message: "Only image and audio files are supported." }, 415, noStoreHeaders());
	}

	const upstreamBody = new FormData();
	upstreamBody.append("file", upload, safeFilename(upload.name));

	let upstream: Response;
	try {
		upstream = await fetch("https://api.openai.com/v1/content_provenance_checks", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
				Accept: "application/json",
			},
			body: upstreamBody,
		});
	} catch (error) {
		console.error("[web-api/content-provenance] upstream request failed", error);
		return c.json({ error: "upstream_unavailable", message: "The verification service did not respond. Try again." }, 502, noStoreHeaders());
	}

	if (!upstream.ok) {
		console.error("[web-api/content-provenance] upstream rejected request", { status: upstream.status });
		if (upstream.status === 400) {
			return c.json({ error: "invalid_media", message: "OpenAI could not verify this file. Check that it is a supported, unmodified image or audio file." }, 400, noStoreHeaders());
		}
		if (upstream.status === 404) {
			return c.json({ error: "service_unavailable", message: "Content verification is not available for this account." }, 503, noStoreHeaders());
		}
		if (upstream.status === 429) {
			return c.json({ error: "upstream_rate_limited", message: "The verification service is busy. Try again shortly." }, 429, noStoreHeaders());
		}
		return c.json({ error: "upstream_unavailable", message: "The verification service is temporarily unavailable." }, 502, noStoreHeaders());
	}

	let payload: unknown;
	try {
		payload = await upstream.json();
	} catch {
		return c.json({ error: "invalid_upstream_response", message: "The verification service returned an invalid response." }, 502, noStoreHeaders());
	}
	if (!isProvenanceResponse(payload)) {
		return c.json({ error: "invalid_upstream_response", message: "The verification service returned an invalid response." }, 502, noStoreHeaders());
	}

	return c.json(payload, 200, noStoreHeaders());
});
