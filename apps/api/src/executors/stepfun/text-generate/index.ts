// Purpose: Executor for stepfun / text-generate.
// Why: Keeps provider-specific behavior behind an explicit provider-owned boundary.
// How: Applies provider capability parameters and reuses OpenAI wire-format primitives.

import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs, ExecutorResult } from "@executors/types";
import { executeOpenAIWire } from "@executors/_shared/text-generate/openai-compat";
import { buildTextExecutor, cherryPickIRParams } from "@executors/_shared/text-generate/shared";
import type { ProviderExecutor } from "../../types";

export function preprocess(ir: IRChatRequest, args: ExecutorExecuteArgs): IRChatRequest {
	const filtered = cherryPickIRParams(ir, args.capabilityParams);
	const model = String(args.providerModelSlug ?? filtered.model ?? "").split("/").pop();
	if (model === "step-3.7-flash") {
		const unsupported = [
			["n", (filtered.vendor as any)?.stepfun?.n],
			["stop", filtered.stop],
			["frequency_penalty", filtered.frequencyPenalty],
			["modalities", filtered.modalities],
			["audio", filtered.audioConfig],
		] as const;
		const field = unsupported.find(([, value]) => value !== undefined)?.[0];
		if (field) throw new Error(`stepfun_responses_unsupported_${field}`);
		if (filtered.toolChoice !== undefined && filtered.toolChoice !== "auto") {
			throw new Error("stepfun_responses_tool_choice_must_be_auto");
		}
	}
	return filtered;
}

export async function execute(args: ExecutorExecuteArgs): Promise<ExecutorResult> {
	return executeOpenAIWire(args, { transientRetries: 1 });
}

export function postprocess(ir: IRChatRequest): IRChatRequest {
	return ir;
}

export function transformStream(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
	return stream;
}

export const executor: ProviderExecutor = buildTextExecutor({
	preprocess,
	execute,
	postprocess,
	transformStream,
});
