import type { IRAudioTranscriptionRequest, IRAudioTranscriptionResponse } from "@core/ir";
import type { ExecutorExecuteArgs, ExecutorResult, ProviderExecutor } from "@executors/types";
import { validateWebhookEndpointUrlForDelivery } from "@core/webhook-endpoints";
import { estimateOpenAiSpeechToTextUsage } from "@providers/openai/endpoints/audio-transcription-usage";
import { blobToBase64, runCloudflareModel, unwrapCloudflareResult } from "../shared";

async function resolveAudio(ir: IRAudioTranscriptionRequest, args: ExecutorExecuteArgs): Promise<Blob> {
	if (ir.file) return ir.file;
	const url = ir.fileUrl || ir.s3PresignedUrl;
	if (!url) throw new Error("cloudflare_audio_file_required");
	const validated = await validateWebhookEndpointUrlForDelivery(url);
	if (validated.ok === false) throw new Error(`cloudflare_audio_url_rejected_${validated.reason}`);
	const response = args.upstreamTiming
		? await args.upstreamTiming.fetch(validated.url, { redirect: "manual" }, "media")
		: await fetch(validated.url, { redirect: "manual" });
	if (response.status >= 300 && response.status < 400) throw new Error("cloudflare_audio_redirect_not_allowed");
	if (!response.ok) throw new Error(`cloudflare_audio_fetch_failed_${response.status}`);
	return response.blob();
}

export async function execute(args: ExecutorExecuteArgs): Promise<ExecutorResult> {
	const ir = args.ir as IRAudioTranscriptionRequest;
	const audio = await resolveAudio(ir, args);
	const isTurbo = args.providerModelSlug === "@cf/openai/whisper-large-v3-turbo";
	const requestBody = isTurbo ? JSON.stringify({
		audio: await blobToBase64(audio),
		...(ir.language ? { language: ir.language } : {}),
		...(ir.prompt ? { initial_prompt: ir.prompt } : {}),
	}) : audio;
	const { response, keySource, byokKeyId } = await runCloudflareModel(
		args,
		requestBody,
		isTurbo ? "application/json" : audio.type || "application/octet-stream",
	);
	const rawResponse = await response.clone().json().catch(() => null);
	const result = unwrapCloudflareResult(rawResponse);
	const estimatedUsage = response.ok ? await estimateOpenAiSpeechToTextUsage({ file: audio, prompt: ir.prompt, text: result?.text }) : undefined;
	const usage = estimatedUsage ? {
		...estimatedUsage,
		...(typeof estimatedUsage.input_audio_seconds === "number"
			? { input_audio_minutes: estimatedUsage.input_audio_seconds / 60 }
			: {}),
	} : { requests: 1 };
	const detectedLanguage = result?.transcription_info?.language ?? result?.language;
	const responseIr: IRAudioTranscriptionResponse | undefined = response.ok ? {
		id: args.requestId,
		model: args.providerModelSlug || ir.model,
		provider: args.providerId,
		text: String(result?.text ?? ""),
		language: typeof detectedLanguage === "string" ? detectedLanguage : ir.language,
		words: Array.isArray(result?.words) ? result.words : undefined,
		segments: Array.isArray(result?.segments) ? result.segments : undefined,
		usage: usage as any,
		rawResponse,
	} : undefined;
	return {
		kind: "completed",
		upstream: response,
		ir: responseIr,
		bill: { cost_cents: 0, currency: "USD", usage, upstream_id: response.headers.get("cf-ray"), finish_reason: null },
		keySource,
		byokKeyId,
		rawResponse,
	};
}

export const executor: ProviderExecutor = execute;
