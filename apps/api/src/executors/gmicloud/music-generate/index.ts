// Purpose: Executor for gmicloud / music-generate.
// Why: MiniMax Music 3.0 on GMI Cloud uses the native asynchronous request queue.

import type { IRMusicGenerateRequest, IRMusicGenerateResponse } from "@core/ir";
import type { ExecutorExecuteArgs, ExecutorResult } from "@executors/types";
import type { ProviderExecutor } from "@executors/types";
import { executeGmiQueueRequest, extractMediaUrl, extractQueueOutcome, queueKeyMeta } from "../request-queue";

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
	const payload: Record<string, unknown> = {
		prompt: ir.prompt ?? raw.prompt ?? "",
		...(ir.duration != null ? { duration: ir.duration } : {}),
		...(ir.format ? { format: ir.format } : {}),
		...(typeof raw.lyrics === "string" ? { lyrics: raw.lyrics } : {}),
		...(typeof raw.is_instrumental === "boolean" ? { is_instrumental: raw.is_instrumental } : {}),
		...extensions,
	};
	const requestBody = JSON.stringify({ model, payload });
	const mappedRequest = args.meta.echoUpstreamRequest || args.meta.returnUpstreamRequest ? requestBody : undefined;
	const keyMeta = queueKeyMeta(args);
	const result = await executeGmiQueueRequest(args, model, payload);
	if (!result.response.ok) return errorResult(args, result.response, keyMeta, mappedRequest);

	const audioUrl = extractMediaUrl(result.json);
	if (!audioUrl) {
		return errorResult(
			args,
			new Response(JSON.stringify({ error: "gmicloud_music_output_missing", request_id: result.requestId, result: result.json }), { status: 502, headers: { "Content-Type": "application/json" } }),
			keyMeta,
			mappedRequest,
		);
	}
	const outcome = extractQueueOutcome(result.json);
	const response: IRMusicGenerateResponse = {
		id: args.requestId,
		nativeId: result.requestId,
		model: ir.model,
		provider: args.providerId,
		status: "completed",
		audioUrl,
		result: result.json,
		usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 1, ...(typeof outcome?.duration === "number" ? { output_audio_seconds: outcome.duration } : {}) } as any,
		rawResponse: result.json,
	};
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
