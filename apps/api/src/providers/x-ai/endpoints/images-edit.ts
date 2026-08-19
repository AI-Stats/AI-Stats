import { ImagesEditSchema, type ImagesEditRequest } from "@core/schemas";
import { buildImagePricingRequestOptions } from "@core/image-request-options";
import { computeBill } from "@pipeline/pricing/engine";
import type { AdapterResult, ProviderExecuteArgs } from "../../types";
import { buildAdapterPayload } from "../../utils";
import { openAICompatHeaders, openAICompatUrl, resolveOpenAICompatKey } from "../../openai-compatible/config";
import { upstreamTestHeaders } from "@providers/shared/testing";

function invalidParameterResponse(param: string, message: string): Response {
	return new Response(JSON.stringify({ error: { type: "invalid_request_error", message, param } }), { status: 400, headers: { "Content-Type": "application/json" } });
}

async function imageUrl(value: string | Blob): Promise<string> {
	if (typeof value === "string") return value;
	const bytes = new Uint8Array(await value.arrayBuffer());
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return `data:${value.type || "image/png"};base64,${btoa(binary)}`;
}

export async function exec(args: ProviderExecuteArgs): Promise<AdapterResult> {
	const keyInfo = await resolveOpenAICompatKey(args);
	const body = buildAdapterPayload(ImagesEditSchema, args.body, ["meta", "usage"]).adapterPayload as ImagesEditRequest;
	const images = Array.isArray(body.image) ? body.image : [body.image];
	if (images.length !== 1) {
		const upstream = invalidParameterResponse("image", "xAI image editing currently accepts exactly one source image through the gateway.");
		return { kind: "completed", upstream, bill: { cost_cents: 0, currency: "USD", usage: undefined, upstream_id: null, finish_reason: null }, keySource: keyInfo.source, byokKeyId: keyInfo.byokId };
	}
	const unsupported = body.mask !== undefined ? "mask" : body.stream ? "stream" : body.partial_images !== undefined ? "partial_images" : body.background !== undefined ? "background" : body.input_fidelity !== undefined ? "input_fidelity" : null;
	if (unsupported) {
		const upstream = invalidParameterResponse(unsupported, `xAI image editing does not support ${unsupported}.`);
		return { kind: "completed", upstream, bill: { cost_cents: 0, currency: "USD", usage: undefined, upstream_id: null, finish_reason: null }, keySource: keyInfo.source, byokKeyId: keyInfo.byokId };
	}
	const model = args.providerModelSlug || body.model;
	const request = { model, prompt: body.prompt, image: { url: await imageUrl(images[0]) }, ...(typeof body.n === "number" ? { n: body.n } : {}), ...(body.response_format ? { response_format: body.response_format } : {}) };
	const res = await (args.upstreamTiming?.fetch ?? fetch)(openAICompatUrl(args.providerId, "/images/edits"), {
		method: "POST", headers: openAICompatHeaders(args.providerId, keyInfo.key, upstreamTestHeaders(args.meta)), body: JSON.stringify(request),
	});
	const normalized = await res.clone().json().catch(() => undefined);
	const usageMeters: Record<string, unknown> = normalized?.usage && typeof normalized.usage === "object" ? { ...normalized.usage } : {};
	usageMeters.requests = 1;
	usageMeters.input_image = 1;
	usageMeters.output_image = Array.isArray(normalized?.data) && normalized.data.length > 0 ? normalized.data.length : body.n ?? 1;
	let cost_cents = 0;
	let currency: "USD" | "EUR" = "USD";
	let usage: any = usageMeters;
	if (res.ok && args.pricingCard) {
		const priced = computeBill(usageMeters, args.pricingCard, buildImagePricingRequestOptions(body, usageMeters));
		cost_cents = priced.pricing.total_cents;
		currency = priced.pricing.currency;
		usage = priced;
	}
	return { kind: "completed", upstream: res, normalized, bill: { cost_cents, currency, usage, upstream_id: res.headers.get("x-request-id"), finish_reason: null }, keySource: keyInfo.source, byokKeyId: keyInfo.byokId };
}
