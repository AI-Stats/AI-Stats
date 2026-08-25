// Purpose: Executor for gmicloud / audio-speech.
// Why: MiniMax Speech 2.8 on GMI Cloud is a queue-backed native TTS endpoint.

import type { IRAudioSpeechRequest, IRAudioSpeechResponse } from "@core/ir";
import type { ExecutorExecuteArgs, ExecutorResult } from "@executors/types";
import type { ProviderExecutor } from "@executors/types";
import { fetchUpstream } from "@executors/_shared/timing/upstream";
import { executeGmiQueueRequest, extractMediaUrl, queueKeyMeta } from "../request-queue";

function voiceName(voice: IRAudioSpeechRequest["voice"]): string | undefined {
	if (typeof voice === "string") return voice.trim() || undefined;
	if (!voice || typeof voice !== "object") return undefined;
	return String((voice as any).id ?? (voice as any).name ?? (voice as any).voiceName ?? "").trim() || undefined;
}

function baseMime(format: string | undefined): string {
	return format === "wav" ? "audio/wav" : format === "ogg" ? "audio/ogg" : "audio/mpeg";
}

export async function execute(args: ExecutorExecuteArgs): Promise<ExecutorResult> {
	const ir = args.ir as IRAudioSpeechRequest;
	const model = args.providerModelSlug || "minimax-tts-speech-2.8-hd";
	const raw = ir.rawRequest && typeof ir.rawRequest === "object" ? ir.rawRequest as Record<string, any> : {};
	const vendor = ir.vendor as Record<string, any> | undefined;
	const extensions = (vendor?.gmicloud ?? raw.gmicloud ?? vendor?.minimax ?? raw.minimax ?? {}) as Record<string, any>;
	const format = ir.responseFormat ?? ir.format ?? "mp3";
	const payload: Record<string, unknown> = {
		text: ir.input,
		...(voiceName(ir.voice) ? { voice_id: voiceName(ir.voice) } : {}),
		format,
		...(typeof ir.speed === "number" ? { speed: String(ir.speed) } : {}),
		...extensions,
	};
	const requestBody = JSON.stringify({ model, payload });
	const mappedRequest = args.meta.echoUpstreamRequest || args.meta.returnUpstreamRequest ? requestBody : undefined;
	const keyMeta = queueKeyMeta(args);
	const result = await executeGmiQueueRequest(args, model, payload);
	if (!result.response.ok) {
		return { kind: "completed", ir: undefined, bill: { cost_cents: 0, currency: "USD", usage: undefined, finish_reason: null }, upstream: result.response, keySource: keyMeta.source, byokKeyId: keyMeta.byokId, mappedRequest };
	}

	const audioUrl = extractMediaUrl(result.json);
	if (!audioUrl) {
		return { kind: "completed", ir: undefined, bill: { cost_cents: 0, currency: "USD", usage: undefined, finish_reason: null }, upstream: new Response(JSON.stringify({ error: "gmicloud_speech_output_missing", request_id: result.requestId }), { status: 502, headers: { "Content-Type": "application/json" } }), keySource: keyMeta.source, byokKeyId: keyMeta.byokId, mappedRequest, rawResponse: result.json };
	}

	const mediaResponse = await fetchUpstream(args, audioUrl, undefined, "media");
	const audioData = mediaResponse.ok ? await mediaResponse.arrayBuffer() : null;
	const response: IRAudioSpeechResponse = {
		id: args.requestId,
		nativeId: result.requestId,
		model: ir.model,
		provider: args.providerId,
		audio: audioData ? { data: base64FromArrayBuffer(audioData), mimeType: mediaResponse.headers.get("content-type") ?? baseMime(format) } : { url: audioUrl, mimeType: baseMime(format) },
		usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 1, input_characters: ir.input.length } as any,
		rawResponse: result.json,
	};
	return { kind: "completed", ir: response, bill: { cost_cents: 0, currency: "USD", usage: response.usage as any, upstream_id: result.requestId, finish_reason: null }, upstream: result.response, keySource: keyMeta.source, byokKeyId: keyMeta.byokId, mappedRequest, rawResponse: result.json };
}

function base64FromArrayBuffer(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(binary);
}

export const executor: ProviderExecutor = execute;
