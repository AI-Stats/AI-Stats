import type { AgentStopCondition } from "./types.js";

export function stepCountIs(limit: number): AgentStopCondition {
	return ({ steps }) => steps.length >= Math.max(0, Math.floor(limit)) ? `step_count:${limit}` : false;
}

export function hasToolCall(name: string): AgentStopCondition {
	return ({ steps }) => steps.some((step) => step.toolCalls.some((call) => call.name === name)) ? `tool_call:${name}` : false;
}

export function maxTokensUsed(limit: number): AgentStopCondition {
	return ({ usage }) => usage.totalTokens >= Math.max(0, limit) ? `max_tokens:${limit}` : false;
}

export function maxCost(limit: number): AgentStopCondition {
	return ({ usage }) => usage.cost >= Math.max(0, limit) ? `max_cost:${limit}` : false;
}

export function finishReasonIs(reason: string): AgentStopCondition {
	return ({ steps }) => steps.some((step) => step.finishReason === reason) ? `finish_reason:${reason}` : false;
}

export function maxDuration(ms: number): AgentStopCondition {
	return ({ elapsedMs }) => elapsedMs >= Math.max(0, ms) ? `max_duration:${ms}` : false;
}
