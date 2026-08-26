// Purpose: Executor for gmicloud / music-generate.
// Why: MiniMax Music 3.0 on GMI Cloud uses the native asynchronous request queue.

import type { IRMusicGenerateRequest, IRMusicGenerateResponse } from "@core/ir";
import type { ExecutorExecuteArgs, ExecutorResult } from "@executors/types";
import type { ProviderExecutor } from "@executors/types";
import { saveMusicJobMeta } from "@core/music-jobs";
import { executeGmiQueueRequest, extractMediaBase64, extractMediaUrl, extractQueueOutcome, queueKeyMeta } from "../request-queue";

function errorResult(args: ExecutorExecuteArgs, upstream: Response, keyMeta: ReturnType<typeof queueKeyMeta>, mappedRequest?: string): ExecutorResult {
	return {
		kind: "completed",
		ir: undefined,
		bill: { cost_cents: 0, currency: "USD", usage: undefined, upstream_id: undefined, finish_reason: null },
		upstream,
		keySource: keyMeta.source,
		byokKeyId: keyMeta.byokId,
		mappedRequest,
	};
}

export async function execute(args: ExecutorExecuteArgs): Promise<ExecutorResult> {
	const ir = args.ir as IRMusicGenerateRequest;
	const model = args.providerModelSlug || "minimax-music-3.0";
	const raw = ir.rawRequest && typeof ir.rawRequest === "object" ? ir.rawRequest as Record<string, any> : {};
	const extensions = (ir.vendor?.gmicloud ?? raw.gmicloud ?? ir.vendor?.minimax ?? raw.minimax ?? {}) as Record<string, any>;
	const keyMeta = queueKeyMeta(args);
	const hasLyrics = typeof raw.lyrics === "string" && raw.lyrics.trim().length > 0;
	if (raw.is_instrumental === false && !hasLyrics) {
		return errorResult(
			args,
			new Response(JSON.stringify({ error: "validation_error", reason: "lyrics_required_for_non_instrumental_gmicloud_music" }), { status: 400, headers: { "Content-Type": "application/json" } }),
			keyMeta,
		);
	}
	const rawAudioSetting = raw.audio_setting && typeof raw.audio_setting === "object" && !Array.isArray(raw.audio_setting)
		? raw.audio_setting
		: {};
	const extensionAudioSetting = extensions.audio_setting && typeof extensions.audio_setting === "object" && !Array.isArray(extensions.audio_setting)
		? extensions.audio_setting
		: {};
	const hasAudioSetting = ir.format || Object.keys(extensionAudioSetting).length > 0 || Object.keys(rawAudioSetting).length > 0;
	const audioSetting = hasAudioSetting
		? {
			sample_rate: 44100,
			bitrate: 256000,
			format: "mp3",
			...extensionAudioSetting,
			...rawAudioSetting,
			...(ir.format ? { format: ir.format } : {}),
		}
		: {};
	const lyrics = hasLyrics
		? raw.lyrics
		: "[Instrumental]";
	const payload: Record<string, unknown> = {
		prompt: ir.prompt ?? raw.prompt ?? "",
		...(ir.duration != null ? { duration: ir.duration } : {}),
		lyrics,
		...(typeof raw.is_instrumental === "boolean" ? { is_instrumental: raw.is_instrumental } : {}),
		...extensions,
		...(Object.keys(audioSetting).length > 0 ? { audio_setting: audioSetting } : {}),
	};
	const requestBody = JSON.stringify({ model, payload });
	const mappedRequest = args.meta.echoUpstreamRequest || args.meta.returnUpstreamRequest ? requestBody : undefined;
	const result = await executeGmiQueueRequest(args, model, payload);
	if (!result.response.ok) return errorResult(args, result.response, keyMeta, mappedRequest);

	const audioUrl = extractMediaUrl(result.json);
	const audioBase64 = extractMediaBase64(result.json);
	if (!audioUrl && !audioBase64) {
		return errorResult(
			args,
			new Response(JSON.stringify({ error: "gmicloud_music_output_missing", request_id: result.requestId, result: result.json }), { status: 502, headers: { "Content-Type": "application/json" } }),
			keyMeta,
			mappedRequest,
		);
	}
	const outcome = extractQueueOutcome(result.json);
	const duration = typeof outcome?.duration === "number" ? outcome.duration : null;
	const response: IRMusicGenerateResponse = {
		id: args.requestId,
		nativeId: result.requestId,
		model: ir.model,
		provider: args.providerId,
		status: "completed",
		audioUrl,
		audioBase64,
		result: result.json,
		usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 1, ...(typeof outcome?.duration === "number" ? { output_audio_seconds: outcome.duration } : {}) } as any,
		rawResponse: result.json,
	};
	try {
		await saveMusicJobMeta(args.workspaceId, result.requestId, {
			provider: args.providerId,
			model: ir.model,
			duration,
			format: ir.format ?? null,
			status: response.status,
			nativeResponseId: result.requestId,
			audioBase64: audioBase64 ?? null,
			output: [{
				index: 0,
				id: result.requestId,
				audio_url: audioUrl ?? null,
				audio_base64: audioBase64 ?? null,
				duration,
			}],
			result: result.json,
			rawResponse: result.json,
			createdAt: Date.now(),
		});
	} catch (error) {
		console.error("gmicloud_music_job_meta_store_failed", {
			error,
			workspaceId: args.workspaceId,
			musicId: args.requestId,
		});
	}
	return {
		kind: "completed",
		ir: response,
		bill: { cost_cents: 0, currency: "USD", usage: response.usage as any, upstream_id: result.requestId, finish_reason: null },
		upstream: result.response,
		keySource: keyMeta.source,
		byokKeyId: keyMeta.byokId,
		mappedRequest,
		rawResponse: result.json,
	};
}

export const executor: ProviderExecutor = execute;
