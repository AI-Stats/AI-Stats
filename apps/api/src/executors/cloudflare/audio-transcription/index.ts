import type { IRAudioTranscriptionRequest, IRAudioTranscriptionResponse } from "@core/ir";
import type { ExecutorExecuteArgs, ExecutorResult, ProviderExecutor } from "@executors/types";
import { runCloudflareModel, unwrapCloudflareResult } from "../shared";

async function resolveAudio(ir: IRAudioTranscriptionRequest, args: ExecutorExecuteArgs): Promise<Blob> {
	if (ir.file) return ir.file;
	const url = ir.fileUrl || ir.s3PresignedUrl;
	if (!url) throw new Error("cloudflare_audio_file_required");
	const response = args.upstreamTiming
		? await args.upstreamTiming.fetch(url, undefined, "media")
		: await fetch(url);
	if (!response.ok) throw new Error(`cloudflare_audio_fetch_failed_${response.status}`);
	return response.blob();
}

export async function execute(args: ExecutorExecuteArgs): Promise<ExecutorResult> {
	const ir = args.ir as IRAudioTranscriptionRequest;
	const audio = await resolveAudio(ir, args);
	const { response, keySource, byokKeyId } = await runCloudflareModel(args, audio, audio.type || "application/octet-stream");
	const rawResponse = await response.clone().json().catch(() => null);
	const result = unwrapCloudflareResult(rawResponse);
	const responseIr: IRAudioTranscriptionResponse | undefined = response.ok ? {
		id: args.requestId,
		model: args.providerModelSlug || ir.model,
		provider: args.providerId,
		text: String(result?.text ?? ""),
		language: typeof result?.language === "string" ? result.language : ir.language,
		words: Array.isArray(result?.words) ? result.words : undefined,
		segments: Array.isArray(result?.segments) ? result.segments : undefined,
		usage: { requests: 1 } as any,
		rawResponse,
	} : undefined;
	return {
		kind: "completed",
		upstream: response,
		ir: responseIr,
		bill: { cost_cents: 0, currency: "USD", usage: { requests: 1 }, upstream_id: response.headers.get("cf-ray"), finish_reason: null },
		keySource,
		byokKeyId,
		rawResponse,
	};
}

export const executor: ProviderExecutor = execute;
