import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	audit: vi.fn(),
	from: vi.fn(),
}));

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", ...headers },
	});
}

vi.mock("@/runtime/env", () => ({
	getSupabaseAdmin: () => ({ from: state.from }),
	getBindings: () => ({ KEY_PEPPER_ACTIVE: "pepper" }),
}));

vi.mock("@/pipeline/before/guards", () => ({
	guardManagementAuth: vi.fn(async () => ({
		ok: true,
		value: {
			workspaceId: "ws_1",
			apiKeyId: "mgmt_1",
			userId: "user_1",
			requestId: "req_1",
			internal: true,
			authMethod: "api_key",
			scopes: ["management_keys:delete"],
		},
	})),
}));

vi.mock("@/lib/audit/workspaceAudit", () => ({
	recordWorkspaceAuditEvent: state.audit,
}));

vi.mock("@/routes/utils", () => ({
	json,
	withRuntime: (handler: (req: Request) => Promise<Response>) => async (c: any) => handler(c.req.raw),
}));

describe("management key audit events", () => {
	beforeEach(() => {
		state.audit.mockReset().mockResolvedValue(true);
		const query: any = {
			delete: vi.fn(() => query),
			eq: vi.fn(() => query),
			select: vi.fn(() => query),
			maybeSingle: vi.fn(async () => ({ data: { id: "key_1", name: "Automation" }, error: null })),
		};
		state.from.mockReset().mockReturnValue(query);
		vi.resetModules();
	});

	it("records a workspace audit event after deleting a key", async () => {
		const { managementKeysRoutes } = await import("./management-keys");
		const response = await managementKeysRoutes.request("https://example.com/key_1", { method: "DELETE" });

		expect(response.status).toBe(200);
		expect(state.audit).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				workspaceId: "ws_1",
				actorUserId: "user_1",
				action: "management_key.deleted",
				targetType: "management_key",
				targetId: "key_1",
				targetName: "Automation",
				requestId: "req_1",
			}),
		);
	});
});
