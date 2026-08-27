import { describe, expect, it } from "vitest";
import { encodeNonTextResponse } from "./non-text";

describe("audio translation response encoding", () => {
	it("preserves the official verbose_json translation fields", () => {
		const encoded = encodeNonTextResponse("audio.translations", {
			id: "req_123",
			nativeId: "translation_123",
			model: "openai/whisper-1",
			provider: "openai",
			text: "Hello",
			duration: 1.5,
			language: "english",
			segments: [{ id: 0, start: 0, end: 1.5, text: "Hello" }],
		} as any, "req_123");

		expect(encoded).toMatchObject({
			text: "Hello",
			duration: 1.5,
			language: "english",
			segments: [{ id: 0, start: 0, end: 1.5, text: "Hello" }],
		});
	});
});
