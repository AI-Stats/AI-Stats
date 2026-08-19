// Purpose: Executor for minimax / music-generate.
// Why: Uses MiniMax native music APIs directly instead of relay providers.
// How: Calls MiniMax's synchronous /v1/music_generation endpoint and normalizes its audio response.

import type { IRMusicGenerateRequest, IRMusicGenerateResponse } from "@core/ir";
import type { ExecutorExecuteArgs, ExecutorResult } from "@executors/types";
import { fetchUpstream } from "@executors/_shared/timing/upstream";
import type { ProviderExecutor } from "@executors/types";
import { getBindings } from "@/runtime/env";
import { resolveProviderKey } from "@providers/keys";
const DEFAULT_MINIMAX_BASE_URL = "https://api.minimax.io";

type MiniMaxAudioPayload = {
	audioUrl?: string;
	audioBase64?: string;
};

function toMusicStatus(value: unknown): IRMusicGenerateResponse["status"] {
	if (typeof value === "number" && Number.isFinite(value)) {
		// MiniMax music status codes are numeric in some responses (for example 2 => success).
		if (value >= 2) return "completed";
		if (value === 1) return "in_progress";
		if (value <= -1) return "failed";
		return "queued";
	}
	const status = String(value ?? "").toLowerCase();
	if (status === "completed" || status === "succeeded" || status === "success" || status === "finished") {
		return "completed";
	}
	if (status === "failed" || status === "error" || status === "cancelled" || status === "canceled") return "failed";
	if (status === "running" || status === "processing" || status === "in_progress") return "in_progress";
	return "queued";
}

function isLikelyBase64(value: string): boolean {
	if (!value || value.length < 32) return false;
	const compact = value.replace(/\s+/g, "");
	return compact.length % 4 === 0 && /^[A-Za-z0-9+/]+=*$/.test(compact);
}

function isLikelyHex(value: string): boolean {
	if (!value || value.length < 64) return false;
	const compact = value.replace(/\s+/g, "");
	return compact.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(compact);
}

function hexToBase64(value: string): string | undefined {
	const compact = value.replace(/\s+/g, "");
	if (!isLikelyHex(compact)) return undefined;
	try {
		const bytes = new Uint8Array(compact.length / 2);
		for (let i = 0; i < compact.length; i += 2) {
			bytes[i / 2] = Number.parseInt(compact.slice(i, i + 2), 16);
		}
		let binary = "";
		for (const byte of bytes) {
			binary += String.fromCharCode(byte);
		}
		return btoa(binary);
	} catch {
		return undefined;
	}
}

function extractAudioPayload(json: any): MiniMaxAudioPayload {
	const value =
		json?.audio_url ??
		json?.audioUrl ??
		json?.url ??
		json?.data?.audio ??
		json?.data?.audio_url ??
		json?.data?.audioUrl ??
		json?.output?.audio ??
		json?.output?.audio_url ??
		json?.output?.audioUrl;
	if (typeof value !== "string") return {};
	const trimmed = value.trim();
	if (!trimmed) return {};
	if (trimmed.startsWith("data:audio/")) return { audioUrl: trimmed };
	if (/^https?:\/\//i.test(trimmed)) return { audioUrl: trimmed };
	if (isLikelyHex(trimmed)) {
		const base64 = hexToBase64(trimmed);
		return base64 ? { audioBase64: base64 } : {};
	}
	if (isLikelyBase64(trimmed)) {
		return { audioBase64: trimmed.replace(/\s+/g, "") };
	}
	return {};
}

function toPositiveNumber(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value.trim());
		if (Number.isFinite(parsed) && parsed > 0) return parsed;
	}
	return undefined;
}

function miniMaxApplicationErrorStatus(code: number): number {
	if (code === 1004 || code === 2049) return 401;
	if (code === 1008) return 402;
	if (code === 1002 || code === 2056) return 429;
	if (code === 2013 || code === 1026 || code === 1027) return 400;
	return 502;
}

export async function execute(args: ExecutorExecuteArgs): Promise<ExecutorResult> {
	const ir = args.ir as IRMusicGenerateRequest;
	const model = args.providerModelSlug || ir.model || "music-01";
	const rawRequest = (ir.rawRequest ?? {}) as Record<string, any>;
	const minimaxExtensions = (ir.vendor?.minimax ?? rawRequest.minimax ?? {}) as Record<string, any>;
	const passthroughRequest: Record<string, any> = {
		model,
		prompt: minimaxExtensions.prompt ?? ir.prompt ?? "",
	};
	for (const field of [
		"lyrics", "lyrics_optimizer", "is_instrumental", "audio_url", "audio_base64",
		"cover_feature_id", "audio_setting",
	] as const) {
		if (minimaxExtensions[field] !== undefined) passthroughRequest[field] = minimaxExtensions[field];
	}
	if (passthroughRequest.lyrics == null && typeof rawRequest.lyrics === "string" && rawRequest.lyrics.trim()) {
		passthroughRequest.lyrics = rawRequest.lyrics.trim();
	}
	const isCover = /^music-cover(?:-free)?$/i.test(model);
	if (passthroughRequest.is_instrumental == null) {
		const explicitInstrumental =
			typeof minimaxExtensions.is_instrumental === "boolean"
				? minimaxExtensions.is_instrumental
				: typeof rawRequest.is_instrumental === "boolean"
					? rawRequest.is_instrumental
					: null;
		if (explicitInstrumental != null) {
			passthroughRequest.is_instrumental = explicitInstrumental;
		} else if (!isCover && passthroughRequest.lyrics == null && passthroughRequest.lyrics_optimizer !== true) {
			// Prompt-only chat should steer musical style, not become literal sung lyrics.
			passthroughRequest.is_instrumental = true;
		}
	}
	if (!isCover && passthroughRequest.is_instrumental === false && passthroughRequest.lyrics == null && passthroughRequest.lyrics_optimizer !== true) {
		const validationBody = {
			error: "validation_error",
			reason: "lyrics_required_for_non_instrumental_minimax_music",
			message: "MiniMax Music requires `lyrics` when `is_instrumental` is false.",
		};
		return {
			kind: "completed",
			ir: undefined,
			bill: {
				cost_cents: 0,
				currency: "USD",
				usage: undefined,
				upstream_id: undefined,
				finish_reason: null,
			},
			upstream: new Response(JSON.stringify(validationBody), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			}),
			keySource: "gateway",
			mappedRequest: undefined,
		};
	}
	if (typeof passthroughRequest.prompt !== "string" || passthroughRequest.prompt.length > 2000 || (passthroughRequest.is_instrumental === true && passthroughRequest.prompt.length < 1)) {
		return {
			kind: "completed", ir: undefined,
			bill: { cost_cents: 0, currency: "USD", usage: undefined, upstream_id: undefined, finish_reason: null },
			upstream: new Response(JSON.stringify({ error: "validation_error", reason: "invalid_minimax_music_prompt" }), { status: 400, headers: { "Content-Type": "application/json" } }),
			keySource: "gateway", mappedRequest: undefined,
		};
	}
	if (isCover) {
		const referenceCount = [passthroughRequest.audio_url, passthroughRequest.audio_base64, passthroughRequest.cover_feature_id]
			.filter((value) => typeof value === "string" && value.length > 0).length;
		if (referenceCount !== 1 || passthroughRequest.prompt.length < 10 || passthroughRequest.prompt.length > 300) {
			return {
				kind: "completed", ir: undefined,
				bill: { cost_cents: 0, currency: "USD", usage: undefined, upstream_id: undefined, finish_reason: null },
				upstream: new Response(JSON.stringify({ error: "validation_error", reason: "invalid_minimax_music_cover_request" }), { status: 400, headers: { "Content-Type": "application/json" } }),
				keySource: "gateway", mappedRequest: undefined,
			};
		}
	}
	if (minimaxExtensions.stream === true) {
		return {
			kind: "completed", ir: undefined,
			bill: { cost_cents: 0, currency: "USD", usage: undefined, upstream_id: undefined, finish_reason: null },
			upstream: new Response(JSON.stringify({ error: "not_supported", reason: "minimax_music_streaming_not_supported_by_gateway" }), { status: 400, headers: { "Content-Type": "application/json" } }),
			keySource: "gateway", mappedRequest: undefined,
		};
	}
	passthroughRequest.stream = false;
	passthroughRequest.output_format = minimaxExtensions.output_format ?? "url";
	if (typeof ir.format === "string") {
		if (!["mp3", "wav"].includes(ir.format)) {
			return {
				kind: "completed", ir: undefined,
				bill: { cost_cents: 0, currency: "USD", usage: undefined, upstream_id: undefined, finish_reason: null },
				upstream: new Response(JSON.stringify({ error: "validation_error", reason: "unsupported_minimax_music_audio_format" }), { status: 400, headers: { "Content-Type": "application/json" } }),
				keySource: "gateway", mappedRequest: undefined,
			};
		}
		passthroughRequest.audio_setting = { ...(passthroughRequest.audio_setting ?? {}), format: ir.format };
	}

	const keyInfo = resolveProviderKey(
		{ providerId: args.providerId, byokMeta: args.byokMeta, forceGatewayKey: args.meta.forceGatewayKey },
		() => {
			const bindings = getBindings() as unknown as Record<string, string | undefined>;
			return bindings.MINIMAX_API_KEY;
		},
	);

	const requestBody = JSON.stringify(passthroughRequest);
	const mappedRequest = (args.meta.echoUpstreamRequest || args.meta.returnUpstreamRequest)
		? requestBody
		: undefined;

	const bindings = getBindings() as unknown as Record<string, string | undefined>;
	const baseUrl = String(bindings.MINIMAX_BASE_URL || DEFAULT_MINIMAX_BASE_URL).replace(/\/+$/, "");
	const res = await fetchUpstream(args, `${baseUrl}/v1/music_generation`, {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${keyInfo.key}`,
			"Content-Type": "application/json",
		},
		body: requestBody,
	});

	const bill = {
		cost_cents: 0,
		currency: "USD",
		usage: undefined as any,
		upstream_id: res.headers.get("x-request-id") ?? res.headers.get("request-id") ?? undefined,
		finish_reason: null as string | null,
	};

	if (!res.ok) {
		return {
			kind: "completed",
			ir: undefined,
			bill,
			upstream: res,
			keySource: keyInfo.source,
			byokKeyId: keyInfo.byokId,
			mappedRequest,
		};
	}

	const json = await res.json().catch(() => ({}));
	const audioPayload = extractAudioPayload(json);
	const baseResp = json?.base_resp ?? json?.baseResp ?? null;
	const baseStatusCodeRaw = baseResp?.status_code ?? baseResp?.statusCode;
	const baseStatusCode =
		typeof baseStatusCodeRaw === "number"
			? baseStatusCodeRaw
			: typeof baseStatusCodeRaw === "string"
				? Number(baseStatusCodeRaw)
				: 0;
	const baseStatusMessage =
		typeof (baseResp?.status_msg ?? baseResp?.statusMsg) === "string"
			? String(baseResp.status_msg ?? baseResp.statusMsg).trim()
			: "";
	if (Number.isFinite(baseStatusCode) && baseStatusCode !== 0) {
		const upstreamErrorBody = {
			error: "upstream_error",
			reason: "minimax_music_generation_failed",
			provider: "minimax",
			status_code: baseStatusCode,
			message: baseStatusMessage || "MiniMax music generation failed.",
			result: json,
		};
		return {
			kind: "completed",
			ir: undefined,
			bill,
			upstream: new Response(JSON.stringify(upstreamErrorBody), {
			status: miniMaxApplicationErrorStatus(baseStatusCode),
				headers: { "Content-Type": "application/json" },
			}),
			keySource: keyInfo.source,
			byokKeyId: keyInfo.byokId,
			mappedRequest,
			rawResponse: json,
		};
	}
	const durationSeconds = toPositiveNumber(json?.extra_info?.music_duration);
	const normalizedDurationSeconds = durationSeconds != null ? durationSeconds / 1000 : undefined;
	const usageMeters: Record<string, number> = {
		requests: 1,
		...(normalizedDurationSeconds != null ? { output_audio_seconds: normalizedDurationSeconds } : {}),
	};
	bill.usage = usageMeters;

	const irResponse: IRMusicGenerateResponse = {
		id: args.requestId,
		nativeId: typeof json?.trace_id === "string" ? json.trace_id : undefined,
		model,
		provider: args.providerId,
		status: toMusicStatus(json?.status ?? json?.task_status ?? json?.data?.status),
		audioUrl: audioPayload.audioUrl,
		audioBase64: audioPayload.audioBase64,
		result: json,
		usage: {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
			requests: 1,
			...(usageMeters.output_audio_seconds != null ? { output_audio_seconds: usageMeters.output_audio_seconds } : {}),
		} as any,
		rawResponse: json,
	};

	return {
		kind: "completed",
		ir: irResponse,
		bill,
		upstream: res,
		keySource: keyInfo.source,
		byokKeyId: keyInfo.byokId,
		mappedRequest,
		rawResponse: json,
	};
}

export const executor: ProviderExecutor = execute;
