import type { AgentSchema } from "./types.js";

export class AgentSchemaValidationError extends Error {
	constructor(public readonly target: "tool_input" | "tool_output" | "tool_event" | "agent_output", public readonly details: unknown) {
		super(`Invalid ${target.replace("_", " ")}`);
		this.name = "AgentSchemaValidationError";
	}
}

export function parseAgentSchema<T>(schema: AgentSchema<T> | undefined, value: unknown, target: AgentSchemaValidationError["target"]): T {
	if (!schema) return value as T;
	try {
		if (typeof schema === "function") return schema(value);
		if ("safeParse" in schema) {
			const result = schema.safeParse(value);
			if (result.success === false) throw new AgentSchemaValidationError(target, (result as { success: false; error: unknown }).error);
			return result.data;
		}
		return schema.parse(value);
	} catch (error) {
		if (error instanceof AgentSchemaValidationError) throw error;
		throw new AgentSchemaValidationError(target, error);
	}
}
