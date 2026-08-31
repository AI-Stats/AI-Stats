import { describe, expect, it } from "vitest";
import {
	validateStructuredOutputResponse,
	validateToolCallResponses,
} from "./response-validation";
import { validateJsonSchemaValue } from "@/plugins/response-healing";

const toolRequest = {
	tools: [{
		type: "function",
		function: {
			name: "get_weather",
			parameters: {
				type: "object",
				properties: { city: { type: "string" } },
				required: ["city"],
			},
		},
	}],
};

function toolResponse(name: string, args: string) {
	return {
		choices: [{ message: { tool_calls: [{ function: { name, arguments: args } }] } }],
	};
}

describe("validateToolCallResponses", () => {
	it("tracks invalid JSON, schema mismatches, and unknown tool names", () => {
		expect(validateToolCallResponses(toolRequest, toolResponse("get_weather", "{"))).toMatchObject({
			totalCalls: 1,
			invalidCalls: 1,
			invalidJson: 1,
		});
		expect(validateToolCallResponses(toolRequest, toolResponse("get_weather", '{"city":42}'))).toMatchObject({
			invalidCalls: 1,
			schemaMismatch: 1,
		});
		expect(validateToolCallResponses(toolRequest, toolResponse("delete_everything", "{}"))).toMatchObject({
			invalidCalls: 1,
			unknownToolName: 1,
		});
	});

	it("accepts a known tool with valid arguments", () => {
		expect(validateToolCallResponses(toolRequest, toolResponse("get_weather", '{"city":"London"}'))).toEqual({
			totalCalls: 1,
			invalidCalls: 0,
			invalidJson: 0,
			schemaMismatch: 0,
			unknownToolName: 0,
		});
	});
});

describe("validateStructuredOutputResponse", () => {
	const request = {
		response_format: {
			type: "json_schema",
			json_schema: {
				schema: {
					type: "object",
					properties: { answer: { type: "string" } },
					required: ["answer"],
				},
			},
		},
	};

	it("distinguishes invalid JSON, schema mismatches, and missing output", () => {
		expect(validateStructuredOutputResponse(request, { output_text: "{" }).errorReason).toBe("invalid_json");
		expect(validateStructuredOutputResponse(request, { output_text: '{"answer":42}' }).errorReason).toBe("schema_mismatch");
		expect(validateStructuredOutputResponse(request, {}).errorReason).toBe("missing_output");
	});

	it("accepts a response matching the requested schema", () => {
		expect(validateStructuredOutputResponse(request, { output_text: '{"answer":"yes"}' })).toMatchObject({
			succeeded: true,
			basis: "schema_validation",
			errorReason: null,
		});
	});
});

describe("request-supplied schema patterns", () => {
	it("rejects backtracking-heavy patterns without evaluating them", () => {
		const unsafePattern = `^(${String.fromCharCode(97)}+)+$`;
		const result = validateJsonSchemaValue(
			"a".repeat(4096) + "!",
			{ type: "string", pattern: unsafePattern },
		);
		expect(result.ok).toBe(false);
		expect(result.errors[0]).toContain("unsafe pattern");
	});
});
