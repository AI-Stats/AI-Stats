import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { presetAccessPredicate } from "./gateway-context";

const dialect = new PgDialect();

describe("gateway preset access", () => {
	it("allows shared presets or private presets created by the API key owner", () => {
		const query = dialect.sqlToQuery(presetAccessPredicate("creator-1"));

		expect(query.sql).toBe(
			'("content"."presets"."visibility" in ($1, $2) or "content"."presets"."created_by" = $3)',
		);
		expect(query.params).toEqual(["public", "team", "creator-1"]);
	});
});
