import { describe, expect, it } from "vitest";
import {
	buildAnthropicAwsHeaders,
	collectAnthropicStreamUsage,
	resolveAnthropicAwsAuth,
} from "../index";

describe("Anthropic family transport contract", () => {
	it("builds Claude Platform on AWS API-key transport with workspace scoping", async () => {
		const auth = resolveAnthropicAwsAuth("aws-platform-key", {
			ANTHROPIC_AWS_REGION: "us-west-2",
			ANTHROPIC_AWS_WORKSPACE_ID: "wrkspc_01AbCdEf23",
		});
		expect(auth).toMatchObject({
			mode: "api_key",
			baseUrl: "https://aws-external-anthropic.us-west-2.api.aws",
			region: "us-west-2",
		});
		const headers = await buildAnthropicAwsHeaders(auth, "{}", {
			"Content-Type": "application/json",
			"anthropic-version": "2023-06-01",
		});
		expect(headers).toMatchObject({
			"x-api-key": "aws-platform-key",
			"anthropic-workspace-id": "wrkspc_01AbCdEf23",
		});
	});

	it("signs Claude Platform on AWS using its own SigV4 service", async () => {
		const auth = resolveAnthropicAwsAuth(JSON.stringify({
			accessKeyId: "AKIDEXAMPLE",
			secretAccessKey: "secret",
			region: "us-east-1",
			workspaceId: "wrkspc_Example123",
			baseUrl: "https://claude-platform.example",
		}), {});
		const headers = await buildAnthropicAwsHeaders(auth, "{\"model\":\"claude-sonnet-5\"}", {
			"Content-Type": "application/json",
			"anthropic-version": "2023-06-01",
		});
		expect(headers.Authorization).toContain("/us-east-1/aws-external-anthropic/aws4_request");
		expect(headers["anthropic-workspace-id"]).toBe("wrkspc_Example123");
		expect(headers.Host).toBe("claude-platform.example");
	});

	it("requires a valid workspace for the AWS platform", () => {
		expect(() => resolveAnthropicAwsAuth("aws-platform-key", {}))
			.toThrow("anthropic_aws_workspace_id_missing");
	});

	it("collects authoritative cache and token usage from a streamed message", async () => {
		const sse = [
			`event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 120, cache_creation_input_tokens: 80, cache_read_input_tokens: 20 } } })}\n\n`,
			`event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 17 } })}\n\n`,
			`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`,
		].join("");
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(sse.slice(0, 87)));
				controller.enqueue(new TextEncoder().encode(sse.slice(87)));
				controller.close();
			},
		});
		expect(await collectAnthropicStreamUsage(stream)).toEqual({
			usage: {
				input_tokens: 120,
				cache_creation_input_tokens: 80,
				cache_read_input_tokens: 20,
				output_tokens: 17,
			},
			stopReason: "tool_use",
		});
	});
});
