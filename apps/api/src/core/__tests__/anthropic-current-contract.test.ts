import { describe, expect, it } from "vitest";
import { AnthropicMessagesSchema } from "../schemas";

describe("current Anthropic Messages request contract", () => {
	it("accepts cache-warm, document, thinking, structured-output, and native-tool fields", () => {
		const parsed = AnthropicMessagesSchema.safeParse({
			model: "anthropic/claude-sonnet-4-6",
			max_tokens: 0,
			messages: [{
				role: "user",
				content: [{
					type: "document",
					source: { type: "file", file_id: "file_0123456789" },
					cache_control: { type: "ephemeral", ttl: "1h" },
				}],
			}],
			thinking: { type: "adaptive", display: "summarized" },
			output_config: {
				effort: "high",
				format: {
					type: "json_schema",
					schema: { type: "object", properties: { answer: { type: "string" } } },
				},
			},
			tools: [{ type: "code_execution_20250825", name: "code_execution" }],
			tool_choice: { type: "none", disable_parallel_tool_use: true },
		});

		expect(parsed.success).toBe(true);
	});

	it("requires the documented budget for enabled thinking", () => {
		const parsed = AnthropicMessagesSchema.safeParse({
			model: "anthropic/claude-3-7-sonnet",
			max_tokens: 4096,
			messages: [{ role: "user", content: "Think carefully" }],
			thinking: { type: "enabled" },
		});

		expect(parsed.success).toBe(false);
	});
});
