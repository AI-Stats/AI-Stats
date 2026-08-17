import { afterEach, describe, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ updateIdentity: vi.fn(async () => ({ id: "11111111-1111-4111-8111-111111111111" })), deleteIdentity: vi.fn(async () => undefined) }));
vi.mock("@/repositories/identity", () => ({
	findIdentityBySessionToken: vi.fn(async (_env, token: string) => token ? ({ id: "11111111-1111-4111-8111-111111111111", email: "person@example.com", createdAt: "2025-01-01", appMetadata: {}, userMetadata: { avatar_url: "https://avatars.phaseo.app/avatars/11111111-1111-4111-8111-111111111111/old.png", name: "Test Person" } }) : null),
	updateIdentity: identity.updateIdentity,
	deleteIdentity: identity.deleteIdentity,
}));

import app from "@/index";

const baseEnv = {
	ENV: "development" as const,
	PROFILE_AVATARS_PUBLIC_BASE_URL: "https://avatars.phaseo.app",
};

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const USER_ID = "11111111-1111-4111-8111-111111111111";

function fakeBucket() {
	const objects = new Map<string, { bytes: Uint8Array; contentType: string; cacheControl: string }>();
	const put = vi.fn(async (key: string, value: ArrayBuffer, options?: R2PutOptions) => {
		objects.set(key, {
			bytes: new Uint8Array(value),
			contentType: options?.httpMetadata && !(options.httpMetadata instanceof Headers)
				? options.httpMetadata.contentType ?? "application/octet-stream"
				: "application/octet-stream",
			cacheControl: options?.httpMetadata && !(options.httpMetadata instanceof Headers)
				? options.httpMetadata.cacheControl ?? ""
				: "",
		});
		return { key } as R2Object;
	});
	const remove = vi.fn(async (keys: string | string[]) => {
		for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
	});
	const get = vi.fn(async (key: string) => {
		const object = objects.get(key);
		if (!object) return null;
		return {
			body: new Blob([object.bytes]).stream(),
			httpEtag: '"avatar-etag"',
			writeHttpMetadata(headers: Headers) {
				headers.set("content-type", object.contentType);
				headers.set("cache-control", object.cacheControl);
			},
		} as R2ObjectBody;
	});
	return { bucket: { put, delete: remove, get } as unknown as R2Bucket, get, objects, put, remove };
}

afterEach(() => vi.unstubAllGlobals());

describe("profile avatar routes", () => {
	it("requires authentication before accepting an upload", async () => {
		const { bucket, put } = fakeBucket();
		const response = await app.request(
			"https://phaseo.app/api/account/settings/profile/avatar",
			{ method: "POST", body: PNG_BYTES, headers: { "content-type": "image/png" } },
			{ ...baseEnv, PROFILE_AVATARS_BUCKET: bucket },
		);
		expect(response.status).toBe(401);
		expect(put).not.toHaveBeenCalled();
	});

	it("stores a validated immutable image and updates only the display metadata", async () => {
		const oldUrl = `https://avatars.phaseo.app/avatars/${USER_ID}/old.png`;
		const { bucket, put, remove } = fakeBucket();
		const response = await app.request(
			"https://phaseo.app/api/account/settings/profile/avatar",
			{
				method: "POST",
				body: PNG_BYTES,
				headers: { authorization: "Bearer token", "content-type": "image/png" },
			},
			{ ...baseEnv, PROFILE_AVATARS_BUCKET: bucket },
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		const payload = await response.json<{ avatarUrl: string }>();
		expect(payload.avatarUrl).toMatch(new RegExp(`^https://avatars\\.phaseo\\.app/avatars/${USER_ID}/[\\w-]+\\.png$`));
		expect(put).toHaveBeenCalledWith(
			expect.stringMatching(new RegExp(`^avatars/${USER_ID}/[\\w-]+\\.png$`)),
			expect.any(ArrayBuffer),
			expect.objectContaining({
				httpMetadata: {
					contentType: "image/png",
					cacheControl: "public, max-age=31536000, immutable",
				},
			}),
		);
		expect(identity.updateIdentity).toHaveBeenCalledWith(expect.anything(), USER_ID, expect.objectContaining({ image: payload.avatarUrl }));
		expect(remove).toHaveBeenCalledWith(`avatars/${USER_ID}/old.png`);
	});

	it("rejects a mismatched image payload before writing to R2", async () => {
		const { bucket, put } = fakeBucket();
		const response = await app.request(
			"https://phaseo.app/api/account/settings/profile/avatar",
			{
				method: "POST",
				body: new TextEncoder().encode("not an image"),
				headers: { authorization: "Bearer token", "content-type": "image/png" },
			},
			{ ...baseEnv, PROFILE_AVATARS_BUCKET: bucket },
		);
		expect(response.status).toBe(400);
		expect(put).not.toHaveBeenCalled();
	});

	it("cancels a lengthless upload as soon as it exceeds the byte limit", async () => {
		const { bucket, put } = fakeBucket();
		const cancel = vi.fn();
		let chunkIndex = 0;
		const chunks = [
			PNG_BYTES,
			new Uint8Array(5 * 1024 * 1024),
			new Uint8Array([0xff]),
		];
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				const chunk = chunks[chunkIndex++];
				if (chunk) controller.enqueue(chunk);
				else controller.close();
			},
			cancel,
		});
		const request = new Request(
			"https://phaseo.app/api/account/settings/profile/avatar",
			{
				method: "POST",
				body,
				headers: { authorization: "Bearer token", "content-type": "image/png" },
				duplex: "half",
			} as RequestInit & { duplex: "half" },
		);

		const response = await app.fetch(
			request,
			{ ...baseEnv, PROFILE_AVATARS_BUCKET: bucket },
			{ waitUntil: vi.fn(), passThroughOnException: vi.fn(), props: {} } as unknown as ExecutionContext,
		);

		expect(response.status).toBe(413);
		expect(cancel).toHaveBeenCalledWith("request_body_too_large");
		expect(put).not.toHaveBeenCalled();
	});

	it("uses a same-origin fallback URL outside production", async () => {
		const { bucket } = fakeBucket();
		const response = await app.request(
			"http://localhost:8788/api/account/settings/profile/avatar",
			{
				method: "POST",
				body: PNG_BYTES,
				headers: { authorization: "Bearer token", "content-type": "image/png" },
			},
			{ ...baseEnv, PROFILE_AVATARS_PUBLIC_BASE_URL: undefined, PROFILE_AVATARS_BUCKET: bucket },
		);
		expect(response.status).toBe(200);
		const payload = await response.json<{ avatarUrl: string }>();
		expect(payload.avatarUrl).toMatch(new RegExp(`^/api/_web/profile-avatars/avatars/${USER_ID}/[\\w-]+\\.png$`));
	});

	it("removes the owned R2 avatar when the account is deleted", async () => {
		const oldUrl = `https://avatars.phaseo.app/avatars/${USER_ID}/old.png`;
		const { bucket, remove } = fakeBucket();
		const response = await app.fetch(
			new Request("https://phaseo.app/api/account/settings/account", {
				method: "DELETE",
				headers: { authorization: "Bearer token" },
			}),
			{ ...baseEnv, PROFILE_AVATARS_BUCKET: bucket },
			{
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
				props: {},
			} as unknown as ExecutionContext,
		);
		expect(response.status).toBe(200);
		expect(remove).toHaveBeenCalledWith(`avatars/${USER_ID}/old.png`);
	});

	it("serves fallback Worker URLs with immutable public caching", async () => {
		const { bucket, get, put } = fakeBucket();
		const key = `avatars/${USER_ID}/example.png`;
		await put(key, PNG_BYTES.buffer, {
			httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" },
		});
		const response = await app.request(
			`https://phaseo.app/api/_web/profile-avatars/${key}`,
			{},
			{ ...baseEnv, PROFILE_AVATARS_BUCKET: bucket },
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("public, max-age=31536000, immutable");
		expect(get).toHaveBeenCalledWith(key);
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES);
	});
});
