import { beforeEach, describe, expect, it, vi } from "vitest";

type GuardOk = {
	ok: true;
	value: {
		workspaceId: string;
		apiKeyId: string;
		internal?: boolean;
	};
};

type KeyRow = Record<string, unknown> | null;

const state = vi.hoisted(() => ({
	guardAuthResult: null as GuardOk | { ok: false; response: Response } | null,
	guardManagementAuthResult: null as GuardOk | { ok: false; response: Response } | null,
	keyRows: [] as KeyRow[],
	workspaceRows: [] as Array<Record<string, unknown> | null>,
	updatePayloads: [] as Array<Record<string, unknown>>,
	insertPayloads: [] as Array<Record<string, unknown>>,
	membershipRows: [] as Array<Record<string, unknown> | null>,
	tombstones: [] as Array<{ id: string; workspaceId: string; deletedAt: string }>,
	enforceWorkspaceKeyLimit: vi.fn(async (_workspaceId: string) => undefined),
	setKeyVersion: vi.fn(async () => undefined),
	bindings: { PHASEO_CONTROL_SECRET: "secret", KEY_PEPPER_ACTIVE: "pepper" } as Record<string, unknown>,
}));

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			...headers,
		},
	});
}

vi.mock("@/runtime/env", () => ({
	getCache: () => ({ delete: vi.fn(async () => undefined) }),
	getBindings: () => state.bindings,
}));

vi.mock("@/repositories/api-keys", () => ({
	findApiKeyByIdAndWorkspace: vi.fn(async () => state.keyRows.shift() ?? null),
	findApiKey: vi.fn(async () => state.keyRows.shift() ?? null),
	findApiKeyForInvalidation: vi.fn(async () => state.keyRows.shift() ?? null),
	listApiKeys: vi.fn(async () => ({ total: state.keyRows.length, rows: state.keyRows.splice(0) })),
	createApiKey: vi.fn(async (payload: Record<string, unknown>) => {
		state.insertPayloads.push(payload);
		return state.keyRows.shift() ?? null;
	}),
	updateApiKey: vi.fn(async (_id: string, _workspaceId: string, payload: Record<string, unknown>) => {
		state.updatePayloads.push(payload);
		return state.keyRows.shift() ?? null;
	}),
	tombstoneApiKey: vi.fn(async (id: string, workspaceId: string, deletedAt: string) => {
		state.tombstones.push({ id, workspaceId, deletedAt });
	}),
}));

vi.mock("@/repositories/management", () => ({
	findWorkspaceOwnerUserId: vi.fn(async () => {
		const row = state.workspaceRows.shift();
		return typeof row?.owner_user_id === "string" ? row.owner_user_id : null;
	}),
	findWorkspaceRole: vi.fn(async () => {
		const row = state.membershipRows.shift();
		return typeof row?.role === "string" ? row.role : null;
	}),
}));

vi.mock("@/pipeline/before/guards", () => ({
	guardAuth: vi.fn(async () => state.guardAuthResult),
	guardManagementAuth: vi.fn(async () => state.guardManagementAuthResult),
}));

vi.mock("@/routes/utils", () => ({
	json,
	withRuntime: (handler: (req: Request) => Promise<Response>) => async (c: any) => handler(c.req.raw),
}));

vi.mock("@/core/kv", () => ({
	setKeyVersion: state.setKeyVersion,
}));

vi.mock("@/routes/auth.helpers", () => ({
	generateGatewayKey: vi.fn(() => ({
		kid: "kid_123",
		secret: "secret_123",
		plaintext: "phaseo_v1_sk_kid_123_secret_123",
		prefix: "phaseo_v1_sk_kid_123",
	})),
	hmacSecret: vi.fn(async () => "hashed_secret"),
	timingSafeEqual: vi.fn((a: string, b: string) => a === b),
}));

vi.mock("@/lib/security/keyPepper", () => ({
	resolveActiveKeyPepper: vi.fn(() => "pepper"),
}));

vi.mock("./management-helpers", () => ({
	CHAT_MANAGED_KEY_NAME: "__chat_route_managed_key__",
	enforceWorkspaceKeyLimit: state.enforceWorkspaceKeyLimit,
}));

describe("management key routes", () => {
	beforeEach(() => {
		state.guardAuthResult = {
			ok: true,
			value: { workspaceId: "ws_1", apiKeyId: "key_1" },
		};
		state.guardManagementAuthResult = {
			ok: true,
			value: { workspaceId: "ws_1", apiKeyId: "mgmt_1", internal: false },
		};
		state.keyRows.length = 0;
		state.workspaceRows.length = 0;
		state.membershipRows.length = 0;
		state.updatePayloads.length = 0;
		state.tombstones.length = 0;
		state.setKeyVersion.mockClear();
		state.bindings = { PHASEO_CONTROL_SECRET: "secret", KEY_PEPPER_ACTIVE: "pepper" };
		state.insertPayloads.length = 0;
		state.enforceWorkspaceKeyLimit.mockReset();
		state.enforceWorkspaceKeyLimit.mockResolvedValue(undefined);
		vi.resetModules();
	});

	it("returns current key metadata with hash and computed limit window", async () => {
		state.keyRows.push({
			id: "key_1",
			hash: "hash_1",
			workspace_id: "ws_1",
			name: "Primary Key",
			prefix: "phaseo_v1_sk_abc",
			status: "active",
			scopes: "[\"chat.completions\"]",
			created_by: "user_1",
			created_at: "2026-04-28T10:00:00Z",
			updated_at: "2026-04-28T10:30:00Z",
			last_used_at: "2026-04-28T11:00:00Z",
			soft_blocked: false,
			expires_at: null,
			daily_limit_cost_nanos: 0,
			weekly_limit_cost_nanos: 0,
			monthly_limit_cost_nanos: 25_000_000_000,
		});

		const { currentKeyRoutes } = await import("./keys");
		const response = await currentKeyRoutes.request("https://example.com/");
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data).toMatchObject({
			id: "key_1",
			hash: "hash_1",
			label: "Primary Key",
			limit: 25,
			limit_reset: "monthly",
			include_byok_in_limit: false,
		});
	});

	it("creates a key and applies compatibility limit fields", async () => {
		state.workspaceRows.push({ owner_user_id: "user_1" });
		state.keyRows.push({
			id: "key_new",
			hash: "hash_new",
			workspace_id: "ws_1",
			name: "Analytics Key",
			prefix: "phaseo_v1_sk_kid_123",
			status: "active",
			scopes: "[\"responses\"]",
			created_by: "user_1",
			created_at: "2026-04-28T12:00:00Z",
			updated_at: "2026-04-28T12:00:00Z",
			last_used_at: null,
			soft_blocked: false,
			expires_at: "2027-12-31T23:59:59Z",
			daily_limit_cost_nanos: 0,
			weekly_limit_cost_nanos: 5_000_000_000,
			monthly_limit_cost_nanos: 0,
		});

		const { keysRoutes } = await import("./keys");
		const response = await keysRoutes.request("https://example.com/", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				name: "Analytics Key",
				limit: 5,
				limit_reset: "weekly",
				expires_at: "2027-12-31T23:59:59Z",
			}),
		});
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(state.enforceWorkspaceKeyLimit).toHaveBeenCalledWith("ws_1");
		expect(state.insertPayloads[0]).toMatchObject({
			workspaceId: "ws_1",
			name: "Analytics Key",
			scopes: "[]",
			weeklyLimitCostNanos: 5_000_000_000,
			dailyLimitCostNanos: 0,
			monthlyLimitCostNanos: 0,
		});
		expect(body.data).toMatchObject({
			hash: "hash_new",
			limit: 5,
			limit_reset: "weekly",
			key: "phaseo_v1_sk_kid_123_secret_123",
		});
	});

	it("blocks OAuth workspace members from creating API keys", async () => {
		state.guardManagementAuthResult = {
			ok: true,
			value: {
				workspaceId: "ws_1",
				apiKeyId: "oauth_1",
				internal: false,
				authMethod: "oauth",
				userId: "user_member",
				scopes: ["keys:write"],
			} as any,
		};
		state.membershipRows.push({ role: "member" });

		const { keysRoutes } = await import("./keys");
		const response = await keysRoutes.request("https://example.com/", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "Member Key" }),
		});
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toMatchObject({
			error: "forbidden",
			message: "Workspace owner or admin role is required",
		});
		expect(state.insertPayloads).toEqual([]);
	});

	it("blocks OAuth workspace members from reading individual API keys", async () => {
		state.guardManagementAuthResult = {
			ok: true,
			value: {
				workspaceId: "ws_1",
				apiKeyId: "oauth_1",
				internal: false,
				authMethod: "oauth",
				userId: "user_member",
				scopes: ["keys:read"],
			} as any,
		};
		state.membershipRows.push({ role: "member" });

		const { keysRoutes } = await import("./keys");
		const response = await keysRoutes.request("https://example.com/hash_1");
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toMatchObject({
			error: "forbidden",
			message: "Workspace owner or admin role is required",
		});
		expect(state.keyRows).toEqual([]);
	});

	it("allows OAuth workspace admins to read individual API keys", async () => {
		state.guardManagementAuthResult = {
			ok: true,
			value: {
				workspaceId: "ws_1",
				apiKeyId: "oauth_1",
				internal: false,
				authMethod: "oauth",
				userId: "user_admin",
				scopes: ["keys:read"],
			} as any,
		};
		state.membershipRows.push({ role: "admin" });
		state.keyRows.push({
			id: "key_1",
			hash: "hash_1",
			workspace_id: "ws_1",
			name: "Primary Key",
			prefix: "phaseo_v1_sk_abc",
			status: "active",
		});

		const { keysRoutes } = await import("./keys");
		const response = await keysRoutes.request("https://example.com/hash_1");
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data).toMatchObject({
			id: "key_1",
			hash: "hash_1",
			name: "Primary Key",
		});
	});

	it("updates a key by hash and remaps limit_reset using the existing limit", async () => {
		state.keyRows.push(
			{
				id: "key_1",
				hash: "hash_1",
				workspace_id: "ws_1",
				kid: "kid_1",
				name: "Primary Key",
				prefix: "phaseo_v1_sk_abc",
				status: "active",
				scopes: "[]",
				created_by: "user_1",
				created_at: "2026-04-28T10:00:00Z",
				updated_at: "2026-04-28T10:30:00Z",
				last_used_at: "2026-04-28T11:00:00Z",
				soft_blocked: false,
				expires_at: null,
				daily_limit_cost_nanos: 0,
				weekly_limit_cost_nanos: 0,
				monthly_limit_cost_nanos: 10_000_000_000,
			},
			{
				id: "key_1",
				hash: "hash_1",
				workspace_id: "ws_1",
				name: "Primary Key",
				prefix: "phaseo_v1_sk_abc",
				status: "active",
				scopes: "[]",
				created_by: "user_1",
				created_at: "2026-04-28T10:00:00Z",
				updated_at: "2026-04-28T10:45:00Z",
				last_used_at: "2026-04-28T11:00:00Z",
				soft_blocked: false,
				expires_at: null,
				daily_limit_cost_nanos: 10_000_000_000,
				weekly_limit_cost_nanos: 0,
				monthly_limit_cost_nanos: 0,
			},
		);

		const { keysRoutes } = await import("./keys");
		const response = await keysRoutes.request("https://example.com/hash_1", {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ limit_reset: "daily" }),
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(state.updatePayloads[0]).toMatchObject({
			dailyLimitCostNanos: 10_000_000_000,
			weeklyLimitCostNanos: 0,
			monthlyLimitCostNanos: 0,
		});
		expect(body.data).toMatchObject({
			hash: "hash_1",
			limit: 10,
			limit_reset: "daily",
		});
	});

	it("deletes a key by hash and removes its dependent records", async () => {
		state.keyRows.push({
			id: "key_1",
			workspace_id: "ws_1",
			kid: "kid_1",
			hash: "hash_1",
			name: "Primary Key",
			status: "active",
		});

		const { keysRoutes } = await import("./keys");
		const response = await keysRoutes.request("https://example.com/hash_1", {
			method: "DELETE",
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ deleted: true });
		expect(state.tombstones).toEqual([{ id: "key_1", workspaceId: "ws_1", deletedAt: expect.any(String) }]);
	});

	it("accepts legacy control bindings while invalidating a cached key", async () => {
		state.bindings = {
			GATEWAY_CONTROL_SECRET: "legacy-secret",
			GATEWAY_CONTROL_KEY: "legacy-control-key",
			KEY_PEPPER_ACTIVE: "pepper",
		};
		state.guardManagementAuthResult = {
			ok: false,
			response: json({ error: "unauthorized" }, 401),
		};
		state.keyRows.push({
			id: "key_legacy",
			kid: "kid_legacy",
			workspace_id: "ws_legacy",
			status: "active",
		});

		const { keysRoutes } = await import("./keys");
		const response = await keysRoutes.request("https://example.com/key_legacy/invalidate", {
			method: "POST",
			headers: {
				authorization: "Bearer legacy-control-key",
				"x-control-secret": "legacy-secret",
			},
		});

		expect(response.status).toBe(200);
		expect(state.setKeyVersion).toHaveBeenCalledWith("kid", "kid_legacy", expect.any(Number));
	});

	it("allows scoped management auth to invalidate without a shared control secret", async () => {
		state.bindings = { KEY_PEPPER_ACTIVE: "pepper" };
		state.keyRows.push({
			id: "key_scoped",
			kid: "kid_scoped",
			workspace_id: "ws_1",
			status: "active",
		});

		const { keysRoutes } = await import("./keys");
		const response = await keysRoutes.request("https://example.com/key_scoped/invalidate", {
			method: "POST",
		});

		expect(response.status).toBe(200);
		expect(state.setKeyVersion).toHaveBeenCalledWith("kid", "kid_scoped", expect.any(Number));
	});
});
