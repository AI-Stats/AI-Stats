import { describe, expect, it } from "vitest";
import { AudioSpeechSchema, AudioTranslationSchema } from "./schemas";

describe("AudioSpeechSchema", () => {
    it("accepts the OpenAI SSE stream contract", () => {
        const result = AudioSpeechSchema.safeParse({
            model: "openai/gpt-4o-mini-tts",
            input: "hello",
            voice: { id: "voice_1234" },
            response_format: "opus",
            stream_format: "sse",
            speed: 4,
            instructions: "Speak warmly.",
        });

        expect(result.success).toBe(true);
    });

    it("enforces OpenAI speech text, instructions, and speed limits", () => {
        expect(AudioSpeechSchema.safeParse({
            model: "openai/gpt-4o-mini-tts",
            input: "x".repeat(4097),
            voice: "alloy",
        }).success).toBe(false);
        expect(AudioSpeechSchema.safeParse({
            model: "openai/gpt-4o-mini-tts",
            input: "hello",
            voice: "alloy",
            instructions: "x".repeat(4097),
        }).success).toBe(false);
        expect(AudioSpeechSchema.safeParse({
            model: "openai/gpt-4o-mini-tts",
            input: "hello",
            voice: "alloy",
            speed: 4.01,
        }).success).toBe(false);
    });

	it("uses ElevenLabs' current per-model character limits", () => {
		expect(AudioSpeechSchema.safeParse({ model: "eleven-labs/eleven-v3", input: "x".repeat(5000) }).success).toBe(true);
		expect(AudioSpeechSchema.safeParse({ model: "eleven-labs/eleven-v3", input: "x".repeat(5001) }).success).toBe(false);
		expect(AudioSpeechSchema.safeParse({ model: "eleven-labs/eleven-flash-v2", input: "x".repeat(30000) }).success).toBe(true);
		expect(AudioSpeechSchema.safeParse({ model: "eleven-labs/eleven-flash-v2.5", input: "x".repeat(40000) }).success).toBe(true);
	});
});

describe("AudioTranslationSchema", () => {
    const fileLike = (overrides: Partial<File> = {}) => ({
        name: "speech.wav",
        type: "audio/wav",
        size: 1024,
        arrayBuffer: async () => new ArrayBuffer(0),
        stream: () => new ReadableStream(),
        ...overrides,
    }) as File;

    it("accepts the current OpenAI translation contract", () => {
        const result = AudioTranslationSchema.safeParse({
            model: "openai/whisper-1",
            file: fileLike(),
            prompt: "Product names: Phaseo",
            temperature: 1,
            response_format: "verbose_json",
        });

        expect(result.success).toBe(true);
    });

    it("rejects unsupported temperature, output format, file format, and files over 25 MB", () => {
        const base = { model: "openai/whisper-1", file: fileLike() };
        expect(AudioTranslationSchema.safeParse({ ...base, temperature: 1.01 }).success).toBe(false);
        expect(AudioTranslationSchema.safeParse({ ...base, response_format: "diarized_json" }).success).toBe(false);
        expect(AudioTranslationSchema.safeParse({ ...base, file: fileLike({ name: "speech.aac", type: "audio/aac" }) }).success).toBe(false);
        expect(AudioTranslationSchema.safeParse({ ...base, file: fileLike({ size: 25 * 1024 * 1024 + 1 }) }).success).toBe(false);
    });
});
