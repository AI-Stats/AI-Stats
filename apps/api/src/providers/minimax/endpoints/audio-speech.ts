// Purpose: MiniMax native synchronous HTTP text-to-speech adapter.
// Why: MiniMax uses /t2a_v2 and returns JSON/hex or native SSE, not OpenAI's
// binary /audio/speech response contract.

import { AudioSpeechSchema } from "@core/schemas";
import type { AdapterResult, ProviderExecuteArgs } from "../../types";
import { openAICompatHeaders, openAICompatUrl, resolveOpenAICompatKey } from "../../openai-compatible/config";
import { sanitizePayload } from "../../utils";
import { upstreamTestHeaders } from "@providers/shared/testing";

const MODELS = new Set([
	"speech-2.8-hd", "speech-2.8-turbo", "speech-2.6-hd", "speech-2.6-turbo",
	"speech-02-hd", "speech-02-turbo", "speech-01-hd", "speech-01-turbo",
]);

function errorResult(status: number, message: string, param?: string): AdapterResult {
	const normalized = { error: { type: "invalid_request_error", message, ...(param ? { param } : {}) } };
	const upstream = new Response(JSON.stringify(normalized), { status, headers: { "content-type": "application/json" } });
	return {
		kind: "completed", upstream, normalized,
		bill: { cost_cents: 0, currency: "USD", usage: undefined, upstream_id: null, finish_reason: null },
		keySource: null, byokKeyId: null,
	};
}

function voiceId(voice: any): string | undefined {
	if (typeof voice === "string" && voice.trim()) return voice.trim();
	for (const value of [voice?.id, voice?.voice_id, voice?.name, voice?.voiceName]) {
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return undefined;
}

function hexBytes(hex: string): Uint8Array {
	if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) throw new Error("invalid_minimax_audio_hex");
	const bytes = new Uint8Array(hex.length / 2);
	for (let index = 0; index < bytes.length; index++) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
	return bytes;
}

function base64(bytes: Uint8Array): string {
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
	}
	return btoa(binary);
}

function mimeType(format: string): string {
	if (format === "wav" || format === "pcmu_wav") return "audio/wav";
	if (format === "flac") return "audio/flac";
	if (format === "opus") return "audio/ogg";
	if (format === "pcm" || format === "pcmu_raw") return "audio/pcm";
	return "audio/mpeg";
}

function statusFor(code: number): number {
	if (code === 1001) return 504;
	if (code === 1002 || code === 1039) return 429;
	if (code === 1004) return 401;
	if (code === 1042 || code === 2013) return 400;
	return 502;
}

function providerError(json: any): AdapterResult | null {
	const code = Number(json?.base_resp?.status_code ?? 0);
	if (!code) return null;
	const normalized = { error: { type: `minimax_${code}`, message: json?.base_resp?.status_msg || "MiniMax speech synthesis failed" } };
	const upstream = new Response(JSON.stringify(normalized), { status: statusFor(code), headers: { "content-type": "application/json" } });
	return {
		kind: "completed", upstream, normalized,
		bill: { cost_cents: 0, currency: "USD", usage: undefined, upstream_id: json?.trace_id ?? null, finish_reason: null },
		keySource: null, byokKeyId: null,
	};
}

function usage(json: any, fallbackCharacters: number): Record<string, number> {
	return {
		requests: 1,
		input_characters: Number(json?.extra_info?.usage_characters) || fallbackCharacters,
	};
}

function transformSse(response: Response, fallbackCharacters: number): {
	stream: ReadableStream<Uint8Array>;
	usageFinalizer: () => Promise<any>;
} {
	const reader = response.body!.getReader();
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	let buffer = "";
	let finalUsage: Record<string, number> = { requests: 1, input_characters: fallbackCharacters };
	let resolveDone!: () => void;
	const done = new Promise<void>((resolve) => { resolveDone = resolve; });
	const stream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			const { value, done: ended } = await reader.read();
			buffer += decoder.decode(value ?? new Uint8Array(), { stream: !ended });
			const frames = buffer.split(/\r?\n\r?\n/);
			buffer = ended ? "" : frames.pop() ?? "";
			for (const frame of frames.concat(ended && buffer.trim() ? [buffer] : [])) {
				const data = frame.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("");
				if (!data || data === "[DONE]") continue;
				let json: any;
				try { json = JSON.parse(data); } catch { continue; }
				const code = Number(json?.base_resp?.status_code ?? 0);
				if (code) {
					controller.error(new Error(`minimax_${code}:${json?.base_resp?.status_msg ?? "speech synthesis failed"}`));
					resolveDone();
					return;
				}
				if (json?.extra_info) finalUsage = usage(json, fallbackCharacters);
				if (typeof json?.data?.audio === "string" && json.data.audio) {
					controller.enqueue(encoder.encode(`event: speech.audio.delta\ndata: ${JSON.stringify({ type: "speech.audio.delta", audio: base64(hexBytes(json.data.audio)) })}\n\n`));
				}
				if (json?.data?.status === 2) {
					controller.enqueue(encoder.encode(`event: speech.audio.done\ndata: ${JSON.stringify({ type: "speech.audio.done", usage: finalUsage })}\n\n`));
				}
			}
			if (ended) { controller.close(); resolveDone(); }
		},
		cancel(reason) { resolveDone(); return reader.cancel(reason); },
	});
	return { stream, usageFinalizer: async () => { await done; return finalUsage; } };
}

export async function exec(args: ProviderExecuteArgs): Promise<AdapterResult> {
	const body: any = sanitizePayload(AudioSpeechSchema, args.body);
	const model = args.providerModelSlug || args.model || body.model;
	if (!MODELS.has(model)) return errorResult(400, "Unsupported MiniMax speech model", "model");
	if (body.input.length >= 10_000) return errorResult(400, "MiniMax synchronous speech input must be less than 10000 characters", "input");
	const config = body.config?.minimax && typeof body.config.minimax === "object" ? body.config.minimax : {};
	const resolvedVoice = voiceId(body.voice ?? config.voice_setting);
	const timbreWeights = config.timbre_weights;
	if (!resolvedVoice && !Array.isArray(timbreWeights)) return errorResult(400, "MiniMax speech requires a voice or timbre_weights", "voice");
	const format = body.response_format ?? body.format ?? config.audio_setting?.format ?? "mp3";
	if (!new Set(["mp3", "wav", "flac", "opus", "pcm", "pcmu_raw", "pcmu_wav"]).has(format)) return errorResult(400, "Unsupported MiniMax output format", "response_format");
	const nativeFormat = format;
	const wantsSse = body.stream_format === "sse";
	const outputFormat = wantsSse ? "hex" : (config.output_format ?? "hex");
	if (outputFormat !== "hex" && outputFormat !== "url") return errorResult(400, "MiniMax output_format must be hex or url", "config.minimax.output_format");
	if (wantsSse && format === "wav") return errorResult(400, "MiniMax streaming does not support wav", "response_format");
	if (body.instructions != null) return errorResult(400, "MiniMax speech does not support instructions", "instructions");

	const request = {
		model,
		text: body.input,
		stream: wantsSse,
		...(wantsSse ? { stream_options: { ...(config.stream_options ?? {}), exclude_aggregated_audio: true } } : {}),
		output_format: outputFormat,
		...(resolvedVoice ? { voice_setting: { ...(config.voice_setting ?? {}), voice_id: resolvedVoice, ...(body.speed != null ? { speed: body.speed } : {}) } } : {}),
		...(Array.isArray(timbreWeights) ? { timbre_weights: timbreWeights } : {}),
		audio_setting: { ...(config.audio_setting ?? {}), format: nativeFormat },
		...Object.fromEntries(Object.entries(config).filter(([key]) => !["voice_setting", "audio_setting", "timbre_weights", "output_format"].includes(key))),
	};
	const keyInfo = await resolveOpenAICompatKey(args);
	const response = await (args.upstreamTiming?.fetch ?? fetch)(openAICompatUrl(args.providerId, "/t2a_v2"), {
		method: "POST",
		headers: openAICompatHeaders(args.providerId, keyInfo.key, upstreamTestHeaders(args.meta)),
		body: JSON.stringify(request),
	});
	const baseBill = { cost_cents: 0, currency: "USD" as const, usage: undefined as any, upstream_id: response.headers.get("x-request-id"), finish_reason: null };
	if (response.ok && wantsSse && response.body) {
		const transformed = transformSse(response, body.input.length);
		return {
			kind: "stream", upstream: response, stream: transformed.stream,
			usageFinalizer: async () => ({ ...baseBill, usage: await transformed.usageFinalizer() }), bill: baseBill,
			keySource: keyInfo.source, byokKeyId: keyInfo.byokId,
		};
	}
	const json = await response.clone().json().catch(() => null);
	if (response.ok) {
		const failure = providerError(json);
		if (failure) return { ...failure, keySource: keyInfo.source, byokKeyId: keyInfo.byokId };
		if (typeof json?.data?.audio !== "string") return errorResult(502, "MiniMax speech response did not include audio");
		const normalizedUsage = usage(json, body.input.length);
		if (outputFormat === "url") {
			return {
				kind: "completed", upstream: response,
				normalized: { id: json?.trace_id, audio_url: json.data.audio, mime_type: mimeType(format), usage: normalizedUsage },
				bill: { ...baseBill, upstream_id: json?.trace_id ?? baseBill.upstream_id, usage: normalizedUsage },
				keySource: keyInfo.source, byokKeyId: keyInfo.byokId,
			};
		}
		const bytes = hexBytes(json.data.audio);
		const audioResponse = new Response(new Blob([bytes.buffer as ArrayBuffer], { type: mimeType(format) }), { status: 200, headers: { "content-type": mimeType(format) } });
		const bill = { ...baseBill, upstream_id: json?.trace_id ?? baseBill.upstream_id, usage: normalizedUsage };
		return { kind: "stream", upstream: audioResponse, stream: audioResponse.body!, usageFinalizer: async () => bill, bill, keySource: keyInfo.source, byokKeyId: keyInfo.byokId };
	}
	return { kind: "completed", upstream: response, bill: baseBill, keySource: keyInfo.source, byokKeyId: keyInfo.byokId };
}
