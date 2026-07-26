import {
	continueAgent,
	runAgent,
} from "./runtime/loop.js";
import { createAgentStreamResult } from "./stream-result.js";
import type {
	AgentContinueOptions,
	AgentDefinition,
	AgentRunOptions,
	AgentTool,
} from "./types.js";

export function defineTool<TInput = unknown, TOutput = unknown, TContext = unknown>(
	tool: AgentTool<TInput, TOutput, TContext>,
) {
	return tool;
}

export const tool = defineTool;

export function createAgent<TInput = unknown, TOutput = string, TContext = unknown>(
	definition: AgentDefinition<TInput, TOutput, TContext>,
) {
	return {
		definition,
		run: (options: AgentRunOptions<TInput, TContext, TOutput>) => runAgent(definition, options),
		stream: (options: AgentRunOptions<TInput, TContext, TOutput>) => createAgentStreamResult({
			parentSignal: options.signal,
			execute: (signal, streamEvent) => runAgent(definition, {
				...options,
				signal,
				streaming: true,
				onEvent: async (event) => { await options.onEvent?.(event); await streamEvent(event); },
			}),
		}),
		continueRun: (options: AgentContinueOptions<TInput, TOutput, TContext>) =>
			continueAgent(definition, options),
		continueStream: (options: AgentContinueOptions<TInput, TOutput, TContext>) => createAgentStreamResult({
			parentSignal: options.signal,
			execute: (signal, streamEvent) => continueAgent(definition, {
				...options,
				signal,
				streaming: true,
				onEvent: async (event) => { await options.onEvent?.(event); await streamEvent(event); },
			}),
		}),
	};
}
