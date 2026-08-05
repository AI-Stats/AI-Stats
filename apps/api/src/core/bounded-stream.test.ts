import { describe, expect, it } from "vitest";
import {
	BodyLimitExceededError,
	limitReadableStream,
	readResponsePreview,
	readStreamTextWithLimit,
} from "./bounded-stream";

describe("bounded stream helpers", () => {
	it("rejects chunked bodies after the byte limit", async () => {
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("1234"));
				controller.enqueue(new TextEncoder().encode("5678"));
				controller.close();
			},
		});
		await expect(readStreamTextWithLimit(stream, 5)).rejects.toBeInstanceOf(BodyLimitExceededError);
	});

	it("reads only the configured response preview", async () => {
		const preview = await readResponsePreview(new Response("abcdefghij"), 4);
		expect(preview).toBe("abcd");
	});

	it("streams responses until the configured limit", async () => {
		const stream = limitReadableStream(new Response("hello").body, 5);
		expect(await new Response(stream).text()).toBe("hello");
	});
});
