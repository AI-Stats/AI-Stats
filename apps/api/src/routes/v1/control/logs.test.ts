import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	guardResult: null as any,
	rows: [] as Array<Record<string, unknown>>,
	count: 0,
	detail: null as Record<string, unknown> | null,
	listCalls: [] as Array<{ filters: Record<string, unknown>; limit: number; offset: number }>,
	detailCalls: [] as Array<{ workspaceId: string; requestId: string }>,
}));

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", ...headers },
	});
}

vi.mock("@/repositories/activity-logs", () => ({
	listActivityLogs: async (filters: Record<string, unknown>, limit: number, offset: number) => {
		state.listCalls.push({ filters, limit, offset });
		return { rows: state.rows, total: state.count };
	},
	findActivityLog: async (workspaceId: string, requestId: string) => {
		state.detailCalls.push({ workspaceId, requestId });
		return state.detail;
	},
}));

vi.mock("@/pipeline/before/guards", () => ({
	guardManagementAuth: vi.fn(async () => state.guardResult),
}));

vi.mock("@/routes/utils", () => ({
	json,
	withRuntime: (handler: (req: Request) => Promise<Response>) => async (c: any) => handler(c.req.raw),
}));

describe("logs routes", () => {
	beforeEach(() => {
		state.guardResult = {
			ok: true,
			value: { workspaceId: "ws_1", apiKeyId: "mgmt_1", internal: false, scopes: ["activity:read"] },
		};
		state.rows = [{
			request_id: "req_1",
			created_at: "2026-07-11T10:00:00.000Z",
			model_id: "gpt-5-mini",
			provider: "openai",
			status_code: 500,
			success: false,
			error_code: "upstream_error",
			error_message: "Bearer abc.def phaseo_v1_sk_KID_secret sk-providersecret123456 api_key=visible https://user:pass@example.com/path?token=visible\u001b[31m",
		}];
		state.count = 1;
		state.detail = state.rows[0];
		state.listCalls.length = 0;
		state.detailCalls.length = 0;
		vi.resetModules();
	});

	it("applies server-side filters without returning untrusted error text", async () => {
		const { logsRoutes } = await import("./logs");
		const response = await logsRoutes.request("https://example.com/?since=2h&status=5xx&provider=openai&model=gpt-5-mini&endpoint=/v1/responses&request_id=req_1&key_id=key_1&session_id=session_1&error_code=upstream_error&limit=10&offset=5");
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.total).toBe(1);
		expect(body.limit).toBe(10);
		expect(body.offset).toBe(5);
		expect(body.data[0].error_message).toBeUndefined();
		expect(state.listCalls).toEqual([{
			filters: expect.objectContaining({
				workspaceId: "ws_1", provider: "openai", model: "gpt-5-mini",
				endpoint: "/v1/responses", requestId: "req_1", keyId: "key_1",
				sessionId: "session_1", errorCode: "upstream_error",
				status: { kind: "status_range", lower: 500, upper: 599 },
			}),
			limit: 10,
			offset: 5,
		}]);
	});

	it("rejects invalid time and status filters", async () => {
		const { logsRoutes } = await import("./logs");
		const invalidTime = await logsRoutes.request("https://example.com/?since=forever");
		const excessiveRange = await logsRoutes.request("https://example.com/?from=2025-01-01T00:00:00.000Z&to=2026-01-01T00:00:00.000Z");
		const invalidStatus = await logsRoutes.request("https://example.com/?status=failed-ish");

		expect(invalidTime.status).toBe(400);
		expect(excessiveRange.status).toBe(400);
		expect(invalidStatus.status).toBe(400);
	});

	it("rejects cross-workspace access", async () => {
		const { logsRoutes } = await import("./logs");
		const response = await logsRoutes.request("https://example.com/?workspace_id=ws_other");
		expect(response.status).toBe(403);
	});

	it("returns one safe log by request id", async () => {
		const { logsRoutes } = await import("./logs");
		const response = await logsRoutes.request("https://example.com/req_1");
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data.request_id).toBe("req_1");
		expect(body.data.error_message).toBeUndefined();
		expect(state.detailCalls).toEqual([{ workspaceId: "ws_1", requestId: "req_1" }]);
	});

	it("requires the relevant OAuth scope", async () => {
		state.guardResult = {
			ok: true,
			value: { workspaceId: "ws_1", userId: "user_1", authMethod: "oauth", scopes: [] },
		};
		const { logsRoutes } = await import("./logs");
		const response = await logsRoutes.request("https://example.com/");
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body.error).toBe("insufficient_scope");
	});

	it("requires management keys to explicitly carry the activity-read scope", async () => {
		state.guardResult = {
			ok: true,
			value: { workspaceId: "ws_1", apiKeyId: "mgmt_1", internal: false, scopes: [] },
		};
		const { logsRoutes } = await import("./logs");
		const response = await logsRoutes.request("https://example.com/");
		expect(response.status).toBe(403);
	});
});
