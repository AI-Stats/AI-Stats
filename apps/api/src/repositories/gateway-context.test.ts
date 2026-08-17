import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { parsePresetReference, presetAccessPredicate } from "./gateway-context";

const dialect = new PgDialect();

describe("gateway preset access", () => {
	it("allows shared presets or private presets created by the API key owner", () => {
		const query = dialect.sqlToQuery(presetAccessPredicate("creator-1"));

		expect(query.sql).toBe(
			'("content"."presets"."visibility" in ($1, $2) or "content"."presets"."created_by" = $3)',
		);
		expect(query.params).toEqual(["public", "team", "creator-1"]);
	});

	it("parses workspace and public publisher preset references", () => {
		expect(parsePresetReference("@private-preset")).toEqual({
			publisherHandle: null,
			slug: "private-preset",
		});
		expect(parsePresetReference("@publisher-handle/public-preset")).toEqual({
			publisherHandle: "publisher-handle",
			slug: "public-preset",
		});
	});

	it("rejects malformed preset references", () => {
		expect(parsePresetReference("model/preset")).toBeNull();
		expect(parsePresetReference("@")).toBeNull();
		expect(parsePresetReference("@publisher/")).toBeNull();
		expect(parsePresetReference("@publisher/preset/extra")).toBeNull();
	});
});
