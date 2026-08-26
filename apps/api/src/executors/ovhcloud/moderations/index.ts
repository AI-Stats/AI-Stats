// Purpose: Normalize OVHcloud Qwen3Guard chat classifications as moderation results.
// Why: OVHcloud exposes its guard models through Chat Completions, not /moderations.

import type { IRModerationsRequest, IRModerationsResponse, IRModerationsResult } from "@core/ir";
import { fetchUpstream } from "@executors/_shared/timing/upstream";
import type { ExecutorExecuteArgs, ExecutorResult } from "@executors/types";
import { openAICompatHeaders, openAICompatUrl, resolveOpenAICompatKey } from "@providers/openai-compatible/config";
import { upstreamTestHeaders } from "@providers/shared/testing";
import type { ProviderExecutor } from "../../types";

const CATEGORY_LABELS = [
	["violent", "Violent"],
	["non_violent_illegal_acts", "Non-violent Illegal Acts"],
	["sexual_content_or_sexual_acts", "Sexual Content or Sexual Acts"],
	["pii", "PII"],
	["suicide_and_self_harm", "Suicide & Self-Harm"],
	["unethical_acts", "Unethical Acts"],
	["politically_sensitive_topics", "Politically Sensitive Topics"],
	["copyright_violation", "Copyright Violation"],
] as const;

function errorResult(args: ExecutorExecuteArgs, response: Response, rawResponse: unknown): ExecutorResult {
	return {
		kind: "completed",
		upstream: response,
		ir: undefined,
		bill: {
			cost_cents: 0,
			currency: "USD",
			usage: { requests: 0 },
			upstream_id: response.headers.get("x-request-id"),
			finish_reason: null,
		},
		rawResponse,
	};
}

function normalizeInputs(input: IRModerationsRequest["input"]): string[] | null {
	if (typeof input === "string") return [input];
	if (Array.isArray(input) && input.length > 0 && input.every((entry) => typeof entry === "string")) {
		return input;
	}
	return null;
}

function parseGuardResult(content: string): IRModerationsResult {
	const safety = /Safety:\s*(Safe|Unsafe|Controversial)/i.exec(content)?.[1]?.toLowerCase();
	const categoryText = /Categories?:\s*([^\r\n]+)/i.exec(content)?.[1] ?? "";
	const detectedCategories = new Set(
		categoryText.split(",").map((entry) => entry.trim().toLowerCase()),
	);
	const categories = Object.fromEntries(
		CATEGORY_LABELS.map(([key, label]) => [key, detectedCategories.has(label.toLowerCase())]),
	);
	// The public moderation contract has one flagged boolean. Treat OVHcloud's
	// intermediate "Controversial" classification conservatively as flagged.
	return {
		flagged: safety !== "safe",
		categories,
	};
}

function addUsage(
	total: NonNullable<IRModerationsResponse["usage"]>,
	usage: any,
): void {
	const input = usage?.prompt_tokens ?? usage?.input_tokens;
	const output = usage?.completion_tokens ?? usage?.output_tokens;
	const combined = usage?.total_tokens;
	if (typeof input === "number") total.inputTokens = (total.inputTokens ?? 0) + input;
	if (typeof output === "number") total.outputTokens = (total.outputTokens ?? 0) + output;
	if (typeof combined === "number") total.totalTokens = (total.totalTokens ?? 0) + combined;
}

export async function execute(args: ExecutorExecuteArgs): Promise<ExecutorResult> {
	const ir = args.ir as IRModerationsRequest;
	const inputs = normalizeInputs(ir.input);
	if (!inputs) {
		const body = {
			error: {
				type: "invalid_request_error",
				code: "unsupported_ovhcloud_moderation_input",
				message: "OVHcloud Qwen3Guard moderation accepts a string or a non-empty array of strings.",
			},
		};
		return errorResult(args, new Response(JSON.stringify(body), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		}), body);
	}

	const keyInfo = await resolveOpenAICompatKey(args as any);
	const model = args.providerModelSlug?.trim() || ir.model.split("/").pop() || ir.model;
	const requestBodies = inputs.map((input) => ({
		model,
		messages: [{ role: "user", content: input }],
		temperature: 0,
		max_tokens: 512,
	}));
	const results: IRModerationsResult[] = [];
	const rawResponses: unknown[] = [];
	const usage: NonNullable<IRModerationsResponse["usage"]> = {};
	let upstream: Response | null = null;

	for (const requestBody of requestBodies) {
		const response = await fetchUpstream(args, openAICompatUrl(args.providerId, "/chat/completions"), {
			method: "POST",
			headers: openAICompatHeaders(args.providerId, keyInfo.key, {
				"Idempotency-Key": args.requestId,
				...upstreamTestHeaders(args.meta),
			}),
			body: JSON.stringify(requestBody),
		});
		upstream ??= response;
		const json = await response.clone().json().catch(() => null);
		rawResponses.push(json);
		if (!response.ok) return {
			...errorResult(args, response, json),
			keySource: keyInfo.source,
			byokKeyId: keyInfo.byokId,
		};
		const content = json?.choices?.[0]?.message?.content;
		if (typeof content !== "string" || !/Safety:\s*(Safe|Unsafe|Controversial)/i.test(content)) {
			const body = {
				error: {
					type: "upstream_response_error",
					code: "invalid_ovhcloud_guard_response",
					message: "OVHcloud Qwen3Guard returned an unrecognized safety classification.",
				},
			};
			return errorResult(args, new Response(JSON.stringify(body), {
				status: 502,
				headers: { "Content-Type": "application/json" },
			}), { upstream: json, normalized_error: body });
		}
		results.push(parseGuardResult(content));
		addUsage(usage, json?.usage);
	}

	const responseIr: IRModerationsResponse = {
		id: args.requestId,
		nativeId: rawResponses.length === 1 ? (rawResponses[0] as any)?.id : undefined,
		model,
		results,
		usage: Object.keys(usage).length > 0 ? usage : undefined,
		rawResponse: rawResponses.length === 1 ? rawResponses[0] : rawResponses,
	};
	ir.rawRequest = requestBodies.length === 1 ? requestBodies[0] : requestBodies;

	return {
		kind: "completed",
		upstream: upstream!,
		ir: responseIr,
		bill: {
			cost_cents: 0,
			currency: "USD",
			usage: {
				requests: inputs.length,
				input_tokens: usage.inputTokens ?? 0,
				input_text_tokens: usage.inputTokens ?? 0,
				output_tokens: usage.outputTokens ?? 0,
				output_text_tokens: usage.outputTokens ?? 0,
				total_tokens: usage.totalTokens ?? 0,
			},
			upstream_id: upstream!.headers.get("x-request-id"),
			finish_reason: null,
		},
		keySource: keyInfo.source,
		byokKeyId: keyInfo.byokId,
		mappedRequest: args.meta.returnUpstreamRequest || args.meta.echoUpstreamRequest
			? JSON.stringify(ir.rawRequest)
			: undefined,
		rawResponse: responseIr.rawResponse,
	};
}

export const executor: ProviderExecutor = execute;
