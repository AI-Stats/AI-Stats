// Purpose: Executor for akashml / text-generate.
// Why: Keeps provider-specific behavior behind an explicit provider-owned boundary.
// How: Applies provider capability parameters and reuses OpenAI wire-format primitives.

import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs, ExecutorResult } from "@executors/types";
import { executeOpenAIWire } from "@executors/_shared/text-generate/openai-compat";
import { buildTextExecutor, cherryPickIRParams } from "@executors/_shared/text-generate/shared";
import type { ProviderExecutor } from "../../types";

export function preprocess(ir: IRChatRequest, args: ExecutorExecuteArgs): IRChatRequest {
	const filtered = cherryPickIRParams(ir, args.capabilityParams);
	const rawEffort = filtered.reasoning?.effort;
	if (rawEffort === "none" && filtered.model.toLowerCase().includes("gpt-oss")) {
		throw new Error("akashml_gpt_oss_reasoning_cannot_be_disabled");
	}
	return {
		...filtered,
		vendor: {
			...(filtered.vendor ?? {}),
			...(ir.vendor?.akashml ? { akashml: ir.vendor.akashml } : {}),
		},
	};
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
