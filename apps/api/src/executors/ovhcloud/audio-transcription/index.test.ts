import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { IRAudioTranscriptionRequest } from "@core/ir";
import { resolveProviderExecutor } from "@executors/index";
import type { ExecutorExecuteArgs } from "@executors/types";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";

beforeAll(() => setupRuntimeFromEnv({ OVH_AI_ENDPOINTS_ACCESS_TOKEN: "ovh-test-key" } as any));
afterAll(teardownTestRuntime);

function args(ir: IRAudioTranscriptionRequest): ExecutorExecuteArgs {
	return {
		ir,
		requestId: "req_ovh_transcription",
		workspaceId: "ws_ovh",
		providerId: "ovhcloud",
		endpoint: "audio.transcription",
		protocol: "openai.audio.transcription",
		capability: "audio.transcription",
		providerModelSlug: "whisper-large-v3",
		capabilityParams: null,
		byokMeta: [],
		pricingCard: { rules: [] },
		meta: { returnUpstreamRequest: true },
	} as ExecutorExecuteArgs;
}

describe("OVHcloud Whisper transcription", () => {
	it("preserves multipart options, duration usage and diarization", async () => {
		const executor = resolveProviderExecutor("ovhcloud", "audio.transcription");
		expect(executor).toBeTruthy();
		const originalFetch = globalThis.fetch;
		let form: FormData | null = null;
		globalThis.fetch = (async (input, init) => {
			expect(String(input)).toBe("https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/audio/transcriptions");
			expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer ovh-test-key");
			form = init?.body as FormData;
			return new Response(JSON.stringify({
				task: "transcribe", success: true, language: "en", duration: 4.5, text: "hello",
				words: [{ word: "hello", start: 0, end: 1 }],
				segments: [{ id: 1, start: 0, end: 1, text: "hello" }],
				diarization: [{ speaker: 1, start: 0, end: 1, text: "hello" }],
				usage: { type: "duration", seconds: 5 },
			}), { headers: { "Content-Type": "application/json" } });
		}) as typeof fetch;
		try {
			const result = await executor!(args({
				model: "openai/whisper-large-v3",
				file: new File([new Uint8Array(44)], "sample.wav", { type: "audio/wav" }),
				language: "en",
				prompt: "names",
				temperature: 0,
				responseFormat: "verbose_json",
				timestampGranularities: ["word", "segment"],
				diarize: true,
				chunkingStrategy: { type: "server_vad", threshold: 0.6, silence_duration_ms: 250 },
			}));
			expect(form?.get("model")).toBe("whisper-large-v3");
			expect(form?.get("diarize")).toBe("true");
			expect(form?.getAll("timestamp_granularities[]")).toEqual(["word", "segment"]);
			expect(JSON.parse(String(form?.get("chunking_strategy")))).toEqual({
				vad_config: { type: "server_vad", threshold: 0.6, silence_duration_ms: 250 },
			});
			expect(result.kind).toBe("completed");
			if (result.kind === "completed") {
				expect(result.ir).toMatchObject({
					text: "hello",
					diarization: [{ speaker: 1 }],
					usage: { type: "duration", seconds: 5, input_audio_seconds: 5 },
				});
				expect(result.bill.usage).toMatchObject({ input_audio_seconds: 5 });
			}
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("rejects streaming, which current OVHcloud Whisper ignores", async () => {
		const executor = resolveProviderExecutor("ovhcloud", "audio.transcription")!;
		const result = await executor(args({
			model: "openai/whisper-large-v3",
			file: new File([new Uint8Array([1])], "sample.mp3", { type: "audio/mpeg" }),
			stream: true,
		}));
		expect(result.upstream.status).toBe(400);
	});
});
