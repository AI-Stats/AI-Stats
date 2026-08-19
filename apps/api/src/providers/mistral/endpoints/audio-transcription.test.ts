import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupTestRuntime, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { exec } from "./audio-transcription";

beforeAll(() => setupTestRuntime());
afterAll(() => teardownTestRuntime());

const PRICING_CARD = {
	provider: "mistral",
	model: "mistral/voxtral-mini-transcribe-2",
	endpoint: "audio.transcription",
	effective_from: null,
	effective_to: null,
	currency: "USD",
	version: null,
	rules: [{
		meter: "input_audio_minutes",
		unit: "minute",
		unit_size: 1,
		price_per_unit: 0.003,
		currency: "USD",
		pricing_plan: "standard",
		match: [],
		priority: 100,
		effective_from: null,
		effective_to: null,
	}],
} as any;

function args(body: Record<string, unknown>) {
	return {
		endpoint: "audio.transcription",
		model: "mistral/voxtral-mini-transcribe-2",
		body,
		meta: {},
		workspaceId: "team_test",
		providerId: "mistral",
		providerModelSlug: "voxtral-mini-2602",
		byokMeta: [],
		pricingCard: PRICING_CARD,
		stream: body.stream === true,
	} as any;
}

describe("Mistral audio transcription endpoint", () => {
	it("maps native multipart fields and normalizes usage for billing", async () => {
		let form: FormData | undefined;
		const mock = installFetchMock([{
			match: (url, init) => {
				form = init?.body as FormData;
				return url.endsWith("/v1/audio/transcriptions");
			},
			response: jsonResponse({
				model: "voxtral-mini-2602",
				text: "Hello",
				language: "en",
				segments: [{ type: "transcription_segment", text: "Hello", start: 0, end: 1, speaker_id: "0" }],
				usage: { prompt_audio_seconds: 120, prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 },
			}),
		}]);

		const result = await exec(args({
			model: "mistral/voxtral-mini-transcribe-2",
			file_url: "https://example.com/call.mp3",
			diarize: true,
			context_bias: ["Phaseo", "AC-42"],
		}));
		mock.restore();

		expect(form?.get("model")).toBe("voxtral-mini-2602");
		expect(form?.get("file_url")).toBe("https://example.com/call.mp3");
		expect(form?.get("diarize")).toBe("true");
		expect(form?.getAll("context_bias")).toEqual(["Phaseo", "AC-42"]);
		expect(result.normalized).toMatchObject({
			text: "Hello",
			language: "en",
			usage: { input_audio_seconds: 120, input_audio_minutes: 2, prompt_tokens: 4 },
		});
		expect((result.bill.usage as any).pricing.total_nanos).toBe(6_000_000);
	});

	it("passes SSE through and finalizes usage from transcription.done", async () => {
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/v1/audio/transcriptions"),
			response: new Response([
				`event: transcription.text.delta\ndata: ${JSON.stringify({ type: "transcription.text.delta", text: "Hi" })}\n\n`,
				`event: transcription.done\ndata: ${JSON.stringify({ type: "transcription.done", text: "Hi", usage: { prompt_audio_seconds: 60, prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } })}\n\n`,
			].join(""), { headers: { "Content-Type": "text/event-stream" } }),
		}]);

		const result = await exec(args({
			model: "mistral/voxtral-mini-transcribe-2",
			file_id: "file_123",
			stream: true,
		}));
		expect(result.kind).toBe("stream");
		if (result.kind === "stream") {
			expect(await new Response(result.stream).text()).toContain("transcription.done");
			const finalBill = await result.usageFinalizer?.();
			expect((finalBill?.usage as any).input_audio_minutes).toBe(1);
			expect((finalBill?.usage as any).pricing.total_nanos).toBe(3_000_000);
		}
		mock.restore();
	});
});
