import { describe, expect, it, vi } from "vitest";
import { SCIM_URNS } from "./constants";
import { executeBulk, type BulkResourceService } from "./bulk";

function resource(id: string) { return { id, meta: { location: `https://phaseo.ai/scim/v2/Users/${id}`, version: 'W/"1"' } }; }

describe("SCIM Bulk", () => {
	it("resolves bulkId references through shared resource services", async () => {
		const users: BulkResourceService = { create: vi.fn(async () => resource("11111111-1111-4111-8111-111111111111")), replace: vi.fn(), patch: vi.fn(), deactivate: vi.fn() };
		const groups: BulkResourceService = { create: vi.fn(async (value) => ({ ...resource("22222222-2222-4222-8222-222222222222"), captured: value })), replace: vi.fn(), patch: vi.fn(), delete: vi.fn() };
		const audit = vi.fn(async () => undefined);
		const result = await executeBulk({ schemas: [SCIM_URNS.bulkRequest], Operations: [
			{ method: "POST", bulkId: "new-user", path: "/Users", data: { userName: "alice@example.com" } },
			{ method: "POST", bulkId: "new-group", path: "/Groups", data: { displayName: "Engineering", members: [{ value: "bulkId:new-user" }] } },
		] }, { User: users, Group: groups }, audit);
		expect(groups.create).toHaveBeenCalledWith({ displayName: "Engineering", members: [{ value: "11111111-1111-4111-8111-111111111111" }] });
		expect(result.Operations).toHaveLength(2); expect(audit).toHaveBeenCalledTimes(2);
	});

	it("honors failOnErrors", async () => {
		const service: BulkResourceService = { create: vi.fn(async () => { throw new Error("failure"); }), replace: vi.fn(), patch: vi.fn(), delete: vi.fn() };
		const result = await executeBulk({ schemas: [SCIM_URNS.bulkRequest], failOnErrors: 1, Operations: [
			{ method: "POST", bulkId: "one", path: "/Users", data: {} }, { method: "POST", bulkId: "two", path: "/Users", data: {} },
		] }, { User: service, Group: service }, async () => undefined);
		expect(result.Operations).toHaveLength(1);
		expect(result.Operations[0]).toMatchObject({ status: "500" });
	});
});
