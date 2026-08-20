import { describe, expect, it } from "vitest";
import { SCIM_URNS } from "./constants";
import { ScimProtocolError } from "./errors";
import { parseUserPatch } from "./patch";

describe("SCIM User PATCH", () => {
	it("maps deactivation and enterprise attributes to allowlisted columns", () => {
		expect(parseUserPatch({ schemas: [SCIM_URNS.patch], Operations: [
			{ op: "Replace", path: "active", value: false },
			{ op: "replace", path: `${SCIM_URNS.enterpriseUser}:department`, value: "Engineering" },
		] })).toEqual({ active: false, department: "Engineering" });
	});

	it("supports manager and multivalued attribute updates", () => {
		expect(parseUserPatch({ schemas: [SCIM_URNS.patch], Operations: [
			{ op: "replace", path: `${SCIM_URNS.enterpriseUser}:manager`, value: { value: "11111111-1111-4111-8111-111111111111" } },
			{ op: "replace", path: "emails", value: [{ value: "alice@example.com", type: "work" }] },
		] })).toEqual({ manager_scim_user_id: "11111111-1111-4111-8111-111111111111", emails: [{ value: "alice@example.com", type: "work" }] });
	});

	it("supports whole-resource operation values", () => {
		expect(parseUserPatch({ schemas: [SCIM_URNS.patch], Operations: [{ op: "replace", value: { displayName: "Alice", title: "Engineer" } }] })).toEqual({ display_name: "Alice", title: "Engineer" });
	});

	it("appends multivalued attributes for add operations", () => {
		expect(parseUserPatch({ schemas: [SCIM_URNS.patch], Operations: [
			{ op: "add", path: "emails", value: [{ value: "new@example.com", type: "home" }] },
		] }, { emails: [{ value: "existing@example.com", type: "work" }] })).toEqual({ emails: [
			{ value: "existing@example.com", type: "work" },
			{ value: "new@example.com", type: "home" },
		] });
	});

	it("rejects unknown paths", () => {
		expect(() => parseUserPatch({ schemas: [SCIM_URNS.patch], Operations: [{ op: "replace", path: "password", value: "secret" }] })).toThrow(ScimProtocolError);
	});
});
