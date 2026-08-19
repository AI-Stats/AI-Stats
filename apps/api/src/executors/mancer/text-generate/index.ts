// Purpose: Executor for mancer / text-generate.
// Why: Keeps provider-specific behavior behind an explicit provider-owned boundary.
// How: Applies provider capability parameters and reuses OpenAI wire-format primitives.

import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs, ExecutorResult } from "@executors/types";
import { executeOpenAIWire } from "@executors/_shared/text-generate/openai-compat";
import { buildTextExecutor, cherryPickIRParams } from "@executors/_shared/text-generate/shared";
import type { ProviderExecutor } from "../../types";

export function preprocess(ir: IRChatRequest, args: ExecutorExecuteArgs): IRChatRequest {
	return cherryPickIRParams(ir, args.capabilityParams);
}

export async function execute(args: ExecutorExecuteArgs): Promise<ExecutorResult> {
	// Mancer's non-stream response carries its canonical usage object. For
	// streaming clients, its cumulative x-input/output-token fields are decoded
	// by the Mancer stream quirk.
	return executeOpenAIWire(args, { forceChat: true, useClientStreamingMode: true });
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
