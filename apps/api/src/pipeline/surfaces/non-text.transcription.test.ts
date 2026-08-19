import { describe, expect, it } from "vitest";
import { encodeNonTextResponse } from "./non-text";

describe("non-text transcription response encoding", () => {
	it("preserves verbose and diarized response fields", () => {
		const encoded = encodeNonTextResponse("audio.transcription", {
			model: "gpt-4o-transcribe-diarize",
			provider: "openai",
			text: "Agent: hello",
			task: "transcribe",
			language: "english",
			languages: [{ code: "en" }],
			duration: 8.5,
			words: [{ word: "hello", start: 0, end: 1 }],
			segments: [{ id: "seg_1", speaker: "agent", start: 0, end: 1, text: "hello" }],
			diarization: [{ speaker: 1, start: 0, end: 1, text: "hello" }],
			logprobs: [{ token: "hello", logprob: -0.1, bytes: [104] }],
			usage: { type: "duration", seconds: 9 } as any,
		}, "req_transcription");
		expect(encoded).toMatchObject({
			text: "Agent: hello",
			task: "transcribe",
			language: "english",
			languages: [{ code: "en" }],
			duration: 8.5,
			words: [{ word: "hello" }],
			segments: [{ speaker: "agent" }],
			diarization: [{ speaker: 1 }],
			logprobs: [{ token: "hello" }],
			usage: { type: "duration", seconds: 9 },
		});
	});
});
