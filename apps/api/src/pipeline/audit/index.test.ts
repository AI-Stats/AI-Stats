import { beforeEach, describe, expect, it, vi } from "vitest";

const insertGatewayRequestMock = vi.hoisted(() => vi.fn());
const ingestV2GatewayRequestMock = vi.hoisted(() => vi.fn());
const ensureRuntimeForBackgroundMock = vi.fn();
const isLocalTestingModeEnabledMock = vi.fn();
const ensureAppIdMock = vi.fn();
const resolveGatewayIoLoggingPolicyMock = vi.fn();
const persistGatewayIoLogMock = vi.fn();
const persistGatewayUpstreamRequestsMock = vi.fn();

vi.mock("@/runtime/env", () => ({
	ensureRuntimeForBackground: (...args: any[]) => ensureRuntimeForBackgroundMock(...args),
	isLocalTestingModeEnabled: (...args: any[]) => isLocalTestingModeEnabledMock(...args),
}));

vi.mock("@/repositories/audit", () => ({
	insertGatewayRequest: async (row: Record<string, unknown>) => {
		return insertGatewayRequestMock(row);
	},
	ingestV2GatewayRequest: async (event: Record<string, unknown>) => {
		return ingestV2GatewayRequestMock(event);
	},
}));

vi.mock("../after/apps", () => ({
	ensureAppId: (...args: any[]) => ensureAppIdMock(...args),
}));

vi.mock("./io-logging", () => ({
	resolveGatewayIoLoggingPolicy: (...args: any[]) => resolveGatewayIoLoggingPolicyMock(...args),
	persistGatewayIoLog: (...args: any[]) => persistGatewayIoLogMock(...args),
}));

vi.mock("./upstream-requests", () => ({
	persistGatewayUpstreamRequests: (...args: any[]) => persistGatewayUpstreamRequestsMock(...args),
}));

import { auditFailure, auditSuccess } from "./index";

describe("audit persistence", () => {
	beforeEach(() => {
		insertGatewayRequestMock.mockReset();
		ingestV2GatewayRequestMock.mockReset();
		insertGatewayRequestMock.mockResolvedValue({ id: "row_1", created_at: "2026-05-05T12:00:00.000Z", workspace_id: "ws_1" });
		ingestV2GatewayRequestMock.mockResolvedValue("v2_request_event_1");
		ensureRuntimeForBackgroundMock.mockReset();
		isLocalTestingModeEnabledMock.mockReset();
		ensureAppIdMock.mockReset();
		resolveGatewayIoLoggingPolicyMock.mockReset();
		persistGatewayIoLogMock.mockReset();
		persistGatewayUpstreamRequestsMock.mockReset();
		persistGatewayUpstreamRequestsMock.mockResolvedValue(undefined);
		ensureRuntimeForBackgroundMock.mockReturnValue(() => {});
		isLocalTestingModeEnabledMock.mockReturnValue(false);
		ensureAppIdMock.mockResolvedValue("app_resolved");
		resolveGatewayIoLoggingPolicyMock.mockResolvedValue({
			featureEnabled: true,
			captureEnabled: true,
			settings: { enabled: true, retentionDays: 90, includeProviderPayloads: true },
		});
		persistGatewayIoLogMock.mockResolvedValue(undefined);
	});

	it("stores request facts in Postgres and replay payloads in R2", async () => {
		const gatewayRequestRows: any[] = [];

		insertGatewayRequestMock.mockImplementation(async (row) => {
			gatewayRequestRows.push(row);
			return { id: "row_1", created_at: "2026-05-05T12:00:00.000Z", workspace_id: "ws_1" };
		});

		await auditSuccess({
			requestId: "req_success_1",
			workspaceId: "ws_1",
			provider: "openai",
			model: "phaseo/free",
			requestedModel: "phaseo/free",
			endpoint: "chat.completions",
			stream: false,
			byok: false,
			usagePriced: { prompt_tokens: 2, completion_tokens: 1, pricing: { lines: [] } },
			totalCents: 0.001,
			totalNanos: 1000000,
			currency: "USD",
			statusCode: 200,
			requestPayload: {
				model: "openai/gpt-5-nano",
				messages: [{ role: "user", content: "hello" }],
			},
			gatewayResponse: { id: "resp_1", output_text: "hi" },
			providerRequest: { model: "openai/gpt-5-nano", messages: [{ role: "user", content: "hello" }] },
			providerResponse: { id: "chatcmpl_1" },
			detailMetadata: { replay_supported: true },
			providerAttempts: [
				{
					attempt_number: 1,
					provider: "openai",
					api_model_id: "openai/gpt-5-nano",
					outcome: "success",
					status: 200,
				},
			],
		});

		expect(gatewayRequestRows).toHaveLength(1);
		expect(gatewayRequestRows[0]).toEqual(
			expect.objectContaining({
				model_id: "phaseo/free",
				provider: "openai",
				provider_attempts: [
					expect.objectContaining({
						api_model_id: "openai/gpt-5-nano",
					}),
				],
				usage_input_tokens: 2,
				usage_output_tokens: 1,
				usage_total_tokens: 3,
				usage_input_quad_tokens: expect.any(Number),
				usage_output_quad_tokens: expect.any(Number),
				usage_total_quad_tokens: expect.any(Number),
			}),
		);
		expect(gatewayRequestRows[0].usage_input_quad_tokens).toBeGreaterThan(0);
		expect(gatewayRequestRows[0].usage_output_quad_tokens).toBeGreaterThan(0);
		expect(persistGatewayIoLogMock).toHaveBeenCalledOnce();
		expect(persistGatewayIoLogMock).toHaveBeenCalledWith(expect.objectContaining({
			requestId: "req_success_1",
			workspaceId: "ws_1",
			requestPayload: expect.objectContaining({ model: "openai/gpt-5-nano" }),
		}), expect.any(Object));
	});

	it("stores failed request facts in Postgres and replay payloads in R2", async () => {
		const gatewayRequestRows: any[] = [];

		insertGatewayRequestMock.mockImplementationOnce(async (row) => {
			gatewayRequestRows.push(row);
			return { id: "row_2", created_at: "2026-05-05T12:05:00.000Z", workspace_id: "ws_2" };
		});
		ingestV2GatewayRequestMock.mockResolvedValueOnce("v2_request_event_2");

		await auditFailure({
			stage: "execute",
			requestId: "req_failure_1",
			workspaceId: "ws_2",
			endpoint: "responses",
			model: "phaseo/free",
			requestedModel: "phaseo/free",
			provider: "openai",
			stream: false,
			statusCode: 500,
			errorCode: "gateway:upstream_error",
			errorMessage: "provider failed",
			requestPayload: {
				model: "openai/gpt-5.4-nano",
				input: [{ role: "user", content: "retry me" }],
			},
			gatewayResponse: { error: "upstream_error" },
			providerRequest: { model: "openai/gpt-5.4-nano" },
			providerResponse: { error: { message: "bad gateway" } },
			detailMetadata: { replay_supported: true, stage: "execute" },
			providerAttempts: [
				{
					attempt_number: 1,
					provider: "openai",
					api_model_id: "openai/gpt-5.4-nano",
					outcome: "error",
					status: 500,
				},
			],
		});

		expect(gatewayRequestRows).toHaveLength(1);
		expect(gatewayRequestRows[0]).toEqual(
			expect.objectContaining({
				model_id: "phaseo/free",
				provider: "openai",
				provider_attempts: [
					expect.objectContaining({
						api_model_id: "openai/gpt-5.4-nano",
					}),
				],
			}),
		);
		expect(persistGatewayIoLogMock).toHaveBeenCalledOnce();
	});

	it("persists pre-model failures with an explicit unknown model", async () => {
		const gatewayRequestRows: any[] = [];
		insertGatewayRequestMock.mockImplementationOnce(async (row) => {
			gatewayRequestRows.push(row);
			return { id: "row_unknown", created_at: "2026-08-10T19:34:07.000Z", workspace_id: "ws_unknown" };
		});
		ingestV2GatewayRequestMock.mockResolvedValueOnce("v2_request_event_unknown");

		await auditFailure({
			stage: "before",
			requestId: "req_pre_model_failure",
			workspaceId: "ws_unknown",
			endpoint: "responses",
			statusCode: 401,
			errorCode: "user:unauthorised",
			errorMessage: "Unauthorised",
		});

		expect(gatewayRequestRows).toHaveLength(1);
		expect(gatewayRequestRows[0]).toEqual(expect.objectContaining({
			model_id: "unknown",
			canonical_model_id: "unknown",
		}));
	});

	it("keeps payload details out of Postgres and R2 when I/O logging is not explicitly enabled", async () => {
		resolveGatewayIoLoggingPolicyMock.mockResolvedValue({
			featureEnabled: true,
			captureEnabled: false,
			settings: { enabled: false, retentionDays: 90, includeProviderPayloads: true },
		});
		insertGatewayRequestMock.mockResolvedValueOnce({ id: "row_no_io", created_at: "2026-05-05T12:12:00.000Z", workspace_id: "ws_no_io" });
		ingestV2GatewayRequestMock.mockResolvedValueOnce("request-event-id");

		await auditSuccess({
			requestId: "req_no_io",
			workspaceId: "ws_no_io",
			provider: "openai",
			model: "openai/gpt-5-nano",
			endpoint: "chat.completions",
			stream: false,
			byok: false,
			usagePriced: {
				input_tokens: 10,
				output_tokens: 4,
				input_tokens_details: { cached_tokens: 3 },
				output_tool_call_count: 1,
				pricing: { lines: [] },
			},
			totalCents: 0.001,
			currency: "USD",
			statusCode: 200,
			requestPayload: {
				messages: [{ role: "user", content: "private prompt" }],
				response_format: { type: "json_object" },
			},
			gatewayResponse: { output_text: '{"result":"private response"}' },
			providerRequest: { secret: "provider request" },
			providerResponse: { secret: "provider response" },
			providerAttempts: [{
				attempt_number: 1,
				provider: "openai",
				api_model_id: "gpt-5-nano",
				outcome: "success",
				duration_ms: 25,
				status: 200,
			}],
			detailMetadata: {
				routing_snapshot: [{
					rank: 1,
					provider: "openai",
					provider_id: "openai",
					provider_api_model_id: "gpt-5-nano",
					score: 0.82,
					breaker: "closed",
					score_factor_values: [0.99, 0.8, 0.7, 0.6, 1, 0.95, 50, 0.5, 0, 1, 1, 1, 1, 1, 1],
				}],
				routing_diagnostics: {
					filterStages: [{
						stage: "hints.ignore",
						droppedProviders: [{
							providerId: "ignored-provider",
							reason: "listed_in_provider.ignore",
						}],
					}],
				},
			},
		});

		expect(insertGatewayRequestMock).toHaveBeenCalledOnce();
		expect(persistGatewayUpstreamRequestsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: "req_no_io",
				provider: "openai",
			}),
		);
		expect(ingestV2GatewayRequestMock).toHaveBeenCalledOnce();
		const event = ingestV2GatewayRequestMock.mock.calls[0]?.[0];
		expect(event).toEqual(expect.objectContaining({
			request_id: "req_no_io",
			workspace_id: "ws_no_io",
			requested_model_input: "openai/gpt-5-nano",
			cost_nanos: 10_000,
			usage_meters: expect.any(Array),
			tool_call_count: 1,
			tool_call_succeeded: true,
			structured_output_attempted: true,
			structured_output_succeeded: true,
		}));
		expect(event.usage_meters).toEqual(expect.arrayContaining([
			expect.objectContaining({ meter_key: "input_tokens", quantity: 10 }),
			expect.objectContaining({ meter_key: "cached_input_tokens", quantity: 3 }),
			expect.objectContaining({ meter_key: "output_tokens", quantity: 4 }),
		]));
		expect(event.safe_metadata).toEqual(expect.objectContaining({
			cached_input_tokens_are_subset_of_input: true,
		}));
		expect(event.routing_decisions).toEqual([
			expect.objectContaining({
				decision: "ranked",
				provider: "openai",
				rank: 1,
				score: 0.82,
				selected: true,
				attempted: true,
				score_factors: expect.objectContaining({
					price_score: 1,
					success_rate: 0.99,
				}),
			}),
			expect.objectContaining({
				decision: "excluded",
				provider: "ignored-provider",
				exclusion_stage: "hints.ignore",
				exclusion_reason: "listed_in_provider.ignore",
			}),
		]);
		expect(JSON.stringify(event)).not.toContain("private prompt");
		expect(JSON.stringify(event)).not.toContain("private response");
		expect(persistGatewayIoLogMock).not.toHaveBeenCalled();
	});

	it("passes the complete atomic V2 event to the repository", async () => {
		resolveGatewayIoLoggingPolicyMock.mockResolvedValue({
			featureEnabled: true,
			captureEnabled: false,
			settings: { enabled: false, retentionDays: 90, includeProviderPayloads: true },
		});
		insertGatewayRequestMock.mockResolvedValueOnce({ id: "row_atomic", created_at: "2026-05-05T12:13:00.000Z", workspace_id: "ws_atomic" });
		ingestV2GatewayRequestMock.mockResolvedValueOnce("request-event-id");

		await auditSuccess({
			requestId: "req_atomic_event",
			workspaceId: "ws_atomic",
			provider: "openai",
			model: "openai/gpt-5-nano",
			endpoint: "chat.completions",
			stream: true,
			byok: false,
			usagePriced: { input_tokens: 2, output_tokens: 1, pricing: { lines: [] } },
			totalCents: 0.001,
			currency: "USD",
			statusCode: 200,
		});

		expect(ingestV2GatewayRequestMock).toHaveBeenCalledTimes(1);
		expect(ingestV2GatewayRequestMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
			request_id: "req_atomic_event",
			workspace_id: "ws_atomic",
			usage_meters: expect.any(Array),
			routing_decisions: expect.any(Array),
		}));
	});

	it("rejects schema drift instead of silently dropping audit columns", async () => {
		const attemptedRows: any[] = [];
		resolveGatewayIoLoggingPolicyMock.mockResolvedValue({
			featureEnabled: true,
			captureEnabled: false,
			settings: { enabled: false, retentionDays: 90, includeProviderPayloads: false },
		});
		insertGatewayRequestMock.mockImplementation(async (row) => {
			attemptedRows.push(row);
			throw new Error("column provider_ttft_ms does not exist on gateway_requests");
		});
		ingestV2GatewayRequestMock.mockResolvedValueOnce("v2_request_event_strict");

		await expect(auditSuccess({
			requestId: "req_strict_schema",
			workspaceId: "ws_strict",
			provider: "openai",
			model: "openai/gpt-5-nano",
			endpoint: "chat.completions",
			stream: true,
			byok: false,
			usagePriced: { prompt_tokens: 2, completion_tokens: 1, pricing: { lines: [] } },
			totalCents: 0.001,
			totalNanos: 1_000_000,
			currency: "USD",
			statusCode: 200,
			providerTtftMs: 120,
		})).rejects.toThrow("database_audit_success_insert");

		expect(attemptedRows).toHaveLength(3);
		for (const row of attemptedRows) expect(row).toHaveProperty("provider_ttft_ms", 120);
	});
});
