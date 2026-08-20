import { describe, expect, it } from "vitest";
import { SCIM_CONTENT_TYPE, SCIM_URNS } from "./constants";
import { scimError, scimListResponse } from "./http";

describe("SCIM HTTP primitives", () => {
	it("returns RFC-shaped errors with the SCIM media type", async () => {
		const response = scimError(409, "Duplicate userName.", "uniqueness");
		expect(response.status).toBe(409);
		expect(response.headers.get("content-type")).toBe(SCIM_CONTENT_TYPE);
		expect(await response.json()).toEqual({ schemas: [SCIM_URNS.error], status: "409", scimType: "uniqueness", detail: "Duplicate userName." });
	});

	it("builds one-based list responses", () => {
		expect(scimListResponse([{ id: "one" }])).toEqual({ schemas: [SCIM_URNS.listResponse], totalResults: 1, startIndex: 1, itemsPerPage: 1, Resources: [{ id: "one" }] });
	});
});
