import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	auth: null as any,
	rows: [] as any[],
	inserted: null as Record<string, unknown> | null,
	eqCalls: [] as Array<[string, unknown]>,
	audit: vi.fn(async () => true),
}));

function query(table?: string) {
	let mutation: "insert" | null = null;
	const q: any = {
		select: () => q,
		eq: (column: string, value: unknown) => { state.eqCalls.push([column, value]); return q; },
		like: () => q,
		limit: () => Promise.resolve({ data: [], error: null }),
		order: () => Promise.resolve({ data: state.rows, error: null }),
		insert: (payload: Record<string, unknown>) => { mutation = "insert"; state.inserted = payload; return q; },
		maybeSingle: async () => table === "workspaces"
			? { data: { slug: "acme" }, error: null }
			: mutation === "insert"
			? { data: { ...state.inserted }, error: null }
			: { data: state.rows[0] ?? null, error: null },
	};
	return q;
}

vi.mock("@/pipeline/before/guards", () => ({ guardManagementAuth: vi.fn(async () => state.auth) }));
vi.mock("@/runtime/env", () => ({ getSupabaseAdmin: () => ({ from: (table: string) => query(table) }) }));
vi.mock("@/core/provider-credentials", () => ({
	encryptProviderCredential: vi.fn(async () => ({
		enc_value: "encrypted", enc_iv: "iv", enc_tag: "tag", key_version: 1,
		fingerprint_sha256: "fingerprint", prefix: "secret", suffix: "alue",
	})),
}));
vi.mock("@/lib/audit/workspaceAudit", () => ({ recordWorkspaceAuditEvent: state.audit }));
vi.mock("@/routes/utils", () => ({
	json: (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } }),
	withRuntime: (handler: (req: Request) => Promise<Response>) => async (c: any) => handler(c.req.raw),
}));

describe("private model management", () => {
	beforeEach(() => {
		state.auth = { ok: true, value: {
			workspaceId: "00000000-0000-4000-8000-000000000010",
			userId: "00000000-0000-4000-8000-000000000020",
			authMethod: "api_key",
			scopes: ["private_models:read", "private_models:write", "private_models:delete"],
			requestId: "req_private_1",
		} };
		state.rows = [];
		state.inserted = null;
		state.eqCalls = [];
		state.audit.mockClear();
		vi.resetModules();
	});

	it("scopes list queries to the authenticated workspace", async () => {
		const { privateModelsRoutes } = await import("./private-models");
		const response = await privateModelsRoutes.request("https://example.com/");
		expect(response.status).toBe(200);
		expect(state.eqCalls).toContainEqual(["workspace_id", state.auth.value.workspaceId]);
	});

	it("encrypts credentials and never returns endpoint secrets", async () => {
		const { privateModelsRoutes } = await import("./private-models");
		const response = await privateModelsRoutes.request("https://example.com/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				slug: "Legal-Assistant",
				name: "Legal Assistant",
				base_url: "https://models.example.com/v1",
				upstream_model_id: "legal-v4",
				credential: "private-token-value",
				supports_responses: true,
			}),
		});
		expect(response.status).toBe(201);
		expect(state.inserted).toMatchObject({
			workspace_id: state.auth.value.workspaceId,
			model_id: "acme/legal-assistant",
			base_url: "https://models.example.com/v1",
			enc_value: "encrypted",
		});
		const payload = JSON.stringify(await response.json());
		expect(payload).not.toContain("private-token-value");
		expect(payload).not.toContain("enc_value");
		expect(state.audit).toHaveBeenCalled();
	});

	it("rejects private-network endpoint forms before encryption", async () => {
		const { privateModelsRoutes } = await import("./private-models");
		const response = await privateModelsRoutes.request("https://example.com/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				slug: "unsafe",
				name: "Unsafe",
				base_url: "https://127.0.0.1/v1",
				upstream_model_id: "unsafe",
				credential: "private-token-value",
			}),
		});
		expect(response.status).toBe(400);
	});
});
