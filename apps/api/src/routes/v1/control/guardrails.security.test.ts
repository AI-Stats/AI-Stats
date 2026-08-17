import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	guardrailRows: [] as Array<Record<string, unknown> | null>,
	deleteCalls: [] as Array<{ table: string; filters: Array<{ column: string; value: unknown }> }>,
	policyVersionBumps: [] as string[],
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

vi.mock("@/repositories/guardrails", () => ({
	findGuardrail: vi.fn(async (workspaceId: string, id: string) => {
		const index = state.guardrailRows.findIndex((row) => row?.workspace_id === workspaceId && row?.id === id);
		return index >= 0 ? state.guardrailRows.splice(index, 1)[0] : null;
	}),
	deleteGuardrail: vi.fn(async (workspaceId: string, id: string) => {
		state.deleteCalls.push({ table: "workspace_guardrails", filters: [{ column: "workspace_id", value: workspaceId }, { column: "id", value: id }] });
		return true;
	}),
	listGuardrails: vi.fn(), createGuardrail: vi.fn(), updateGuardrail: vi.fn(), listGuardrailKeyIds: vi.fn(),
	validWorkspaceKeyIds: vi.fn(), replaceGuardrailKeys: vi.fn(), addGuardrailKeys: vi.fn(), removeGuardrailKeys: vi.fn(),
	validWorkspaceMemberIds: vi.fn(), addGuardrailMembers: vi.fn(), removeGuardrailMembers: vi.fn(),
}));

vi.mock("@/pipeline/before/guards", () => ({
	guardManagementAuth: vi.fn(async () => ({
		ok: true,
		value: {
			workspaceId: "ws_attacker",
			apiKeyId: "mgmt_1",
			authMethod: "api_key",
			scopes: ["guardrails:delete"],
		},
	})),
}));

vi.mock("@/pipeline/before/workspacePolicy", () => ({
	bumpWorkspacePolicyVersion: vi.fn(async (workspaceId: string) => {
		state.policyVersionBumps.push(workspaceId);
		return 1;
	}),
}));

vi.mock("@/routes/utils", () => ({
	json,
	withRuntime: (handler: (req: Request) => Promise<Response>) => async (c: any) => handler(c.req.raw),
}));

describe("guardrail management security", () => {
	beforeEach(() => {
		state.guardrailRows.length = 0;
		state.deleteCalls.length = 0;
		state.policyVersionBumps.length = 0;
		vi.resetModules();
	});

	it("does not delete dependent guardrail rows before workspace ownership is proven", async () => {
		state.guardrailRows.push({ id: "gr_victim", workspace_id: "ws_victim", name: "Victim" });

		const { guardrailsRoutes } = await import("./guardrails");
		const response = await guardrailsRoutes.request("https://example.com/gr_victim", { method: "DELETE" });
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body).toMatchObject({ error: "not_found" });
		expect(state.deleteCalls).toEqual([]);
	});

	it("cleans up dependent rows after the guardrail belongs to the caller workspace", async () => {
		state.guardrailRows.push({ id: "gr_owned", workspace_id: "ws_attacker", name: "Owned" });

		const { guardrailsRoutes } = await import("./guardrails");
		const response = await guardrailsRoutes.request("https://example.com/gr_owned", { method: "DELETE" });

		expect(response.status).toBe(200);
		expect(state.deleteCalls.map((call) => call.table)).toEqual(["workspace_guardrails"]);
		expect(state.deleteCalls[0].filters).toEqual([
			{ column: "workspace_id", value: "ws_attacker" },
			{ column: "id", value: "gr_owned" },
		]);
		expect(state.policyVersionBumps).toEqual(["ws_attacker"]);
	});
});
