// Purpose: Executor for moonshot-ai / text-generate.
// Why: Isolates provider-specific behavior per capability.
// How: Transforms IR and calls the provider API for this capability.

// Moonshot AI Executor - OpenAI Compatible
// Documentation: https://platform.kimi.ai/docs/api/chat

import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs, ExecutorResult } from "@executors/types";
import { executeOpenAIWire } from "@executors/_shared/text-generate/openai-compat";
import { buildTextExecutor, cherryPickIRParams } from "@executors/_shared/text-generate/shared";
import type { ProviderExecutor } from "../../types";

export function preprocess(ir: IRChatRequest, args: ExecutorExecuteArgs): IRChatRequest {
	const next = cherryPickIRParams(ir, args.capabilityParams);
	const moonshot = (ir.vendor as any)?.moonshot;
	const prediction = (ir.vendor as any)?.openai?.prediction;
	if (moonshot || prediction !== undefined) {
		next.vendor = {
			...(next.vendor ?? {}),
			moonshot: {
				...(moonshot ?? {}),
				...(prediction !== undefined && moonshot?.prediction === undefined ? { prediction } : {}),
			},
		};
	}
	return next;
}

export async function execute(args: ExecutorExecuteArgs): Promise<ExecutorResult> {
	return executeOpenAIWire(args);
}

export function postprocess(ir: any): any {
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
