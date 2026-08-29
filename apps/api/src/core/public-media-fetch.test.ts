import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicMedia } from "./public-media-fetch";

afterEach(() => vi.unstubAllGlobals());

describe("fetchPublicMedia", () => {
	it("rejects private destinations before fetch", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchPublicMedia({ url: "http://127.0.0.1/secret", maxBytes: 10 }))
			.rejects.toThrow("remote_media_url_rejected");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("revalidates redirects and rejects a private redirect target", async () => {
		const fetchMock = vi.fn(async () => new Response(null, {
			status: 302,
			headers: { location: "http://169.254.169.254/latest/meta-data" },
		}));
		vi.stubGlobal("fetch", fetchMock);
		await expect(fetchPublicMedia({ url: "https://public.example/media", maxBytes: 10 }))
			.rejects.toThrow("remote_media_url_rejected");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("cancels a chunked response when it crosses the byte limit", async () => {
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array(8));
				controller.enqueue(new Uint8Array(8));
			},
		});
		vi.stubGlobal("fetch", vi.fn(async () => new Response(stream, { status: 200 })));
		await expect(fetchPublicMedia({ url: "https://public.example/media", maxBytes: 10 }))
			.rejects.toThrow("remote_media_too_large");
	});
});
