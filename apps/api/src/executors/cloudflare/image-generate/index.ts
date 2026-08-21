import type { IRImageGenerationRequest, IRImageGenerationResponse } from "@core/ir";
import type { ExecutorExecuteArgs, ExecutorResult, ProviderExecutor } from "@executors/types";
import { arrayBufferToBase64, blobToBase64, runCloudflareModel, unwrapCloudflareResult } from "../shared";

function dimensions(size?: string): { width?: number; height?: number } {
	const match = /^(\d+)x(\d+)$/.exec(size ?? "");
	return match ? { width: Number(match[1]), height: Number(match[2]) } : {};
}

async function requestBody(ir: IRImageGenerationRequest): Promise<Record<string, unknown>> {
	const raw = ir.rawRequest && typeof ir.rawRequest === "object" ? ir.rawRequest : {};
	const firstImage = Array.isArray(ir.image) ? ir.image[0] : ir.image;
	return {
		prompt: ir.prompt,
		...dimensions(ir.size),
		...(typeof raw.negative_prompt === "string" ? { negative_prompt: raw.negative_prompt } : {}),
		...(typeof raw.seed === "number" ? { seed: raw.seed } : {}),
		...(typeof raw.steps === "number" ? { steps: raw.steps } : {}),
		...(typeof raw.num_steps === "number" ? { num_steps: raw.num_steps } : {}),
		...(firstImage ? { image_b64: typeof firstImage === "string" ? firstImage.replace(/^data:[^,]+,/, "") : await blobToBase64(firstImage) } : {}),
	};
}

export async function execute(args: ExecutorExecuteArgs): Promise<ExecutorResult> {
	const ir = args.ir as IRImageGenerationRequest;
	const body = await requestBody(ir);
	const mappedRequest = args.meta.echoUpstreamRequest || args.meta.returnUpstreamRequest ? JSON.stringify(body) : undefined;
	const { response, keySource, byokKeyId } = await runCloudflareModel(args, JSON.stringify(body), "application/json");
	const contentType = response.headers.get("content-type") ?? "";
	let rawResponse: any = null;
	let image: string | null = null;
	if (contentType.includes("application/json")) {
		rawResponse = await response.clone().json().catch(() => null);
		const result = unwrapCloudflareResult(rawResponse);
		image = typeof result?.image === "string" ? result.image : null;
	} else if (response.ok) {
		image = arrayBufferToBase64(await response.clone().arrayBuffer());
	}
	const responseIr: IRImageGenerationResponse | undefined = response.ok && image ? {
		id: args.requestId,
		created: Math.floor(Date.now() / 1000),
		model: args.providerModelSlug || ir.model,
		provider: args.providerId,
		size: ir.size,
		data: [{ b64Json: image }],
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
		mappedRequest,
		rawResponse,
	};
}

export const executor: ProviderExecutor = execute;
