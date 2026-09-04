import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	row: null as any,
	eqCalls: [] as Array<[string, unknown]>,
}));

vi.mock("@/runtime/env", () => ({
	dispatchBackground: vi.fn(),
	getCache: () => ({ get: vi.fn(), put: vi.fn() }),
	getSupabaseAdmin: () => ({
		from: () => {
			const query: any = {
				select: () => query,
				eq: (column: string, value: unknown) => { state.eqCalls.push([column, value]); return query; },
				maybeSingle: async () => ({ data: state.row, error: null }),
			};
			return query;
		},
	}),
}));
vi.mock("@pipeline/byok/decrypt", () => ({
	decryptBYOK: vi.fn(async () => new TextEncoder().encode("private-endpoint-secret")),
	bytesToString: (value: Uint8Array) => new TextDecoder().decode(value),
}));

describe("workspace private model context", () => {
	beforeEach(() => {
		state.eqCalls = [];
		state.row = {
			id: "00000000-0000-4000-8000-000000000001",
			workspace_id: "00000000-0000-4000-8000-000000000010",
			model_id: "acme/legal-assistant",
			base_url: "https://models.customer.example/v1",
			upstream_model_id: "legal-v4",
			supports_responses: true,
			input_modalities: ["text"],
			output_modalities: ["text"],
			context_length: 32_000,
			max_output_tokens: 4_096,
			provider_id: "private-model:00000000-0000-4000-8000-000000000001",
			enc_value: "encrypted",
			enc_iv: "iv",
			enc_tag: "tag",
			key_version: 1,
			enc_aad_version: 1,
			fingerprint_sha256: "fingerprint",
		};
	});

	it("loads an enabled private route only inside its workspace", async () => {
		const { loadWorkspacePrivateModel } = await import("./context");
		const result = await loadWorkspacePrivateModel({
			workspaceId: state.row.workspace_id,
			model: state.row.model_id,
			endpoint: "text.generate",
		});

		expect(state.eqCalls).toContainEqual(["workspace_id", state.row.workspace_id]);
		expect(state.eqCalls).toContainEqual(["model_id", state.row.model_id]);
		expect(state.eqCalls).toContainEqual(["enabled", true]);
		expect(result?.provider).toMatchObject({
			providerId: "private-model",
			providerModelSlug: "legal-v4",
			privateEndpoint: { baseUrl: "https://models.customer.example/v1", supportsResponses: true },
			byokMeta: [{ key: "private-endpoint-secret" }],
		});
		expect(result?.pricing.rules.every((rule) => rule.price_per_unit === "0")).toBe(true);
	});

	it("allows a workspace-private route to shadow an ordinary catalogue slug", async () => {
		const { loadWorkspacePrivateModel } = await import("./context");
		const workspaceId = state.row.workspace_id;
		state.row = null;
		const result = await loadWorkspacePrivateModel({ workspaceId, model: "openai/gpt-5", endpoint: "text.generate" });
		expect(result).toBeNull();
		expect(state.eqCalls).toContainEqual(["model_id", "openai/gpt-5"]);
	});

	it.each([
		["preferred", true, "priority", 0],
		["balanced", false, "priority", 0],
		["fallback", false, "fallback", 10_000],
	] as const)("maps the %s attachment policy onto provider selection metadata", async (routingPolicy, alwaysUse, routingMode, sortOrder) => {
		const { loadWorkspacePrivateModel } = await import("./context");
		state.row = {
			...state.row,
			model_id: "openai/gpt-5",
			catalog_model_id: "openai/gpt-5",
			routing_policy: routingPolicy,
		};
		const result = await loadWorkspacePrivateModel({
			workspaceId: state.row.workspace_id,
			model: state.row.model_id,
			endpoint: "text.generate",
		});
		expect(result?.attached).toBe(true);
		expect(result?.provider.byokMeta?.[0]).toMatchObject({ alwaysUse, routingMode, sortOrder });
	});
});
