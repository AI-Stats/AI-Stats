import { describe, expect, it } from "vitest";
import { ScimProtocolError } from "./errors";
import { parsePagination, parseScimFilter } from "./filter";

describe("SCIM filters and pagination", () => {
	it("parses the identity-provider equality filters used for discovery", () => {
		expect(parseScimFilter('userName eq "alice@example.com"')).toEqual({ conditions: [{ attribute: "userName", operator: "eq", value: "alice@example.com" }] });
	});

	it("parses the compound equality filters used by Entra", () => {
		expect(parseScimFilter('userName eq "alice@example.com" and externalId eq "entra-1"')).toEqual({ conditions: [
			{ attribute: "userName", operator: "eq", value: "alice@example.com" }, { attribute: "externalId", operator: "eq", value: "entra-1" },
		] });
	});

	it("decodes escaped filter strings", () => {
		expect(parseScimFilter('displayName eq "Platform \\"Core\\""')?.conditions[0]?.value).toBe('Platform "Core"');
	});

	it("rejects unsupported expressions instead of interpreting them loosely", () => {
		expect(() => parseScimFilter('userName co "alice"')).toThrow(ScimProtocolError);
	});

	it("uses one-based pagination and caps page size", () => {
		expect(parsePagination({ startIndex: "2", count: "500" })).toEqual({ startIndex: 2, count: 100 });
		expect(() => parsePagination({ startIndex: "0" })).toThrow(ScimProtocolError);
	});
});
