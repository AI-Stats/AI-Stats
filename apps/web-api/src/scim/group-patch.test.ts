import { describe, expect, it } from "vitest";
import { SCIM_URNS } from "./constants";
import { parseGroupPatch } from "./group-patch";

describe("SCIM Group PATCH", () => {
	it("parses filtered member removal", () => {
		expect(parseGroupPatch({ schemas: [SCIM_URNS.patch], Operations: [{ op: "remove", path: 'members[value eq "11111111-1111-4111-8111-111111111111"]' }] })).toEqual([{ kind: "members-remove", userIds: ["11111111-1111-4111-8111-111111111111"] }]);
	});

	it("parses member additions and group renames", () => {
		expect(parseGroupPatch({ schemas: [SCIM_URNS.patch], Operations: [
			{ op: "Replace", path: "displayName", value: "Platform" },
			{ op: "add", path: "members", value: [{ value: "11111111-1111-4111-8111-111111111111" }] },
		] })).toEqual([{ kind: "attributes", values: { display_name: "Platform" } }, { kind: "members-add", userIds: ["11111111-1111-4111-8111-111111111111"] }]);
	});
});
