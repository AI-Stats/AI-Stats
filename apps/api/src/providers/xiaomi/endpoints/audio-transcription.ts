// Purpose: Xiaomi MiMo V2.5 ASR adapter for gateway audio.transcription.
// Why: Xiaomi exposes ASR through chat.completions with base64 audio, not multipart transcription.
// How: Validates Xiaomi's documented limits, converts the uploaded file to a data URL, and normalizes text output.

import type { AdapterResult, ProviderExecuteArgs } from "../../types";
import { AudioTranscriptionSchema, type AudioTranscriptionRequest } from "@core/schemas";
import { buildAdapterPayload } from "../../utils";
import {
	openAICompatHeaders,
	openAICompatUrl,
	resolveOpenAICompatKey,
} from "../../openai-compatible/config";
import {
	estimateOpenAiSpeechToTextUsage,
	mergeSpeechToTextUsage,
} from "@providers/openai/endpoints/audio-transcription-usage";
import { upstreamTestHeaders } from "@providers/shared/testing";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const SUPPORTED_LANGUAGES = new Set(["auto", "zh", "en"]);

function invalidParameterResponse(param: string, message: string): Response {
	return new Response(JSON.stringify({ error: { type: "invalid_request_error", message, param } }), {
		status: 400,
		headers: { "Content-Type": "application/json" },
	});
}

function emptyBill() {
	return {
		cost_cents: 0,
		currency: "USD" as const,
		usage: undefined as any,
		upstream_id: null,
		finish_reason: null,
	};
}

function toBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	const chunkSize = 0x8000;
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
	}
	return btoa(binary);
}

function resolveAudioMimeType(file: File | Blob): string | null {
	const type = String(file.type ?? "").trim().toLowerCase();
	const filename = typeof (file as File).name === "string" ? (file as File).name.toLowerCase() : "";
	if (type === "audio/wav" || type === "audio/x-wav" || filename.endsWith(".wav")) return "audio/wav";
	if (type === "audio/mpeg" || type === "audio/mp3" || filename.endsWith(".mp3")) return "audio/mpeg";
	return null;
}

function extractTranscript(payload: any): string | undefined {
	const content = payload?.choices?.[0]?.message?.content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return undefined;
	const text = content
		.filter((part: any) => part?.type === "text" && typeof part.text === "string")
		.map((part: any) => part.text)
		.join("")
		.trim();
	return text || undefined;
}

export async function exec(args: ProviderExecuteArgs): Promise<AdapterResult> {
	const keyInfo = await resolveOpenAICompatKey(args);
	const adapterPayload = buildAdapterPayload(AudioTranscriptionSchema, args.body, []).adapterPayload as AudioTranscriptionRequest;
	const body: AudioTranscriptionRequest = {
		...adapterPayload,
		model: args.providerModelSlug || adapterPayload.model,
	};

	if (!body.file) {
		return {
			kind: "completed",
			upstream: invalidParameterResponse("file", "Xiaomi speech recognition requires a file upload."),
			bill: emptyBill(),
			keySource: keyInfo.source,
			byokKeyId: keyInfo.byokId,
		};
	}
	if (body.file.size > MAX_AUDIO_BYTES) {
		return {
			kind: "completed",
			upstream: invalidParameterResponse("file", "Xiaomi speech recognition files must be 10 MB or smaller."),
			bill: emptyBill(),
			keySource: keyInfo.source,
			byokKeyId: keyInfo.byokId,
		};
	}
	const mimeType = resolveAudioMimeType(body.file);
	if (!mimeType) {
		return {
			kind: "completed",
			upstream: invalidParameterResponse("file", "Xiaomi speech recognition supports only WAV and MP3 files."),
			bill: emptyBill(),
			keySource: keyInfo.source,
			byokKeyId: keyInfo.byokId,
		};
	}
	if (body.language && !SUPPORTED_LANGUAGES.has(body.language.toLowerCase())) {
		return {
			kind: "completed",
			upstream: invalidParameterResponse("language", "Xiaomi speech recognition language must be auto, zh, or en."),
			bill: emptyBill(),
			keySource: keyInfo.source,
			byokKeyId: keyInfo.byokId,
		};
	}
	if (body.stream === true) {
		return {
			kind: "completed",
			upstream: invalidParameterResponse("stream", "Streaming Xiaomi transcription is not yet exposed by this gateway endpoint."),
			bill: emptyBill(),
			keySource: keyInfo.source,
			byokKeyId: keyInfo.byokId,
		};
	}

	const audioBase64 = toBase64(await body.file.arrayBuffer());
	const requestBody = {
		model: body.model,
		messages: [{
			role: "user",
			content: [{
				type: "input_audio",
				input_audio: { data: `data:${mimeType};base64,${audioBase64}` },
			}],
		}],
		...(body.language ? { asr_options: { language: body.language.toLowerCase() } } : {}),
	};
	const res = await (args.upstreamTiming?.fetch ?? fetch)(
		openAICompatUrl(args.providerId, "/chat/completions"),
		{
			method: "POST",
			headers: openAICompatHeaders(args.providerId, keyInfo.key, upstreamTestHeaders(args.meta)),
			body: JSON.stringify(requestBody),
		},
	);
	const payload = await res.clone().json().catch(() => undefined);
	const text = extractTranscript(payload);
	let usage = payload?.usage && typeof payload.usage === "object" ? payload.usage : undefined;
	if (res.ok) {
		const estimated = await estimateOpenAiSpeechToTextUsage({ file: body.file, text });
		usage = mergeSpeechToTextUsage(usage, estimated);
	}
	const normalized = payload && typeof payload === "object"
		? { ...payload, ...(text ? { text } : {}), ...(usage ? { usage } : {}) }
		: undefined;

	return {
		kind: "completed",
		upstream: res,
		bill: {
			cost_cents: 0,
			currency: "USD",
			usage,
			upstream_id: res.headers.get("x-request-id") ?? res.headers.get("request-id"),
			finish_reason: payload?.choices?.[0]?.finish_reason ?? null,
		},
		normalized,
		keySource: keyInfo.source,
		byokKeyId: keyInfo.byokId,
	};
}
