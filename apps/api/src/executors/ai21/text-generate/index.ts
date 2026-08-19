// Purpose: Executor for ai21 / text-generate.
// Why: Keeps provider-specific behavior behind an explicit provider-owned boundary.
// How: Applies provider capability parameters and reuses OpenAI wire-format primitives.

import type { IRChatRequest } from "@core/ir";
import type { ExecutorExecuteArgs, ExecutorResult } from "@executors/types";
import { executeOpenAIWire } from "@executors/_shared/text-generate/openai-compat";
import { buildTextExecutor, cherryPickIRParams } from "@executors/_shared/text-generate/shared";
import type { ProviderExecutor } from "../../types";

export function preprocess(ir: IRChatRequest, args: ExecutorExecuteArgs): IRChatRequest {
	const filtered = cherryPickIRParams(ir, args.capabilityParams);
	if (filtered.maxTokens !== undefined && filtered.maxTokens > 4096) throw new Error("ai21_max_tokens_exceeds_4096");
	if (filtered.temperature !== undefined && (filtered.temperature < 0 || filtered.temperature > 2)) throw new Error("ai21_temperature_out_of_range");
	if (filtered.topP !== undefined && (filtered.topP < 0 || filtered.topP > 1)) throw new Error("ai21_top_p_out_of_range");
	if (filtered.stream && filtered.tools?.length) throw new Error("ai21_tools_require_non_streaming");
	if (filtered.responseFormat?.type === "json_schema") throw new Error("ai21_json_schema_not_supported");
	if (filtered.tools?.some((tool) => tool.type && tool.type !== "function")) throw new Error("ai21_only_function_tools_supported");
	for (const message of filtered.messages) {
		if (message.role === "user" || message.role === "system" || message.role === "developer" || message.role === "assistant") {
			if (message.content.some((part) => part.type !== "text")) throw new Error("ai21_text_input_only");
		}
	}
	return {
		...filtered,
		messages: filtered.messages.map((message) => message.role === "developer" ? { ...message, role: "system" as const } : message),
		reasoning: undefined,
		vendor: ir.vendor?.ai21 ? { ai21: ir.vendor.ai21 } : undefined,
	};
}

export async function execute(args: ExecutorExecuteArgs): Promise<ExecutorResult> {
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
