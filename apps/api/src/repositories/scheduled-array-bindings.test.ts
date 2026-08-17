import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { reconciliationStatusPredicate } from "./async-operations";
import { providerEventsPredicate } from "./provider-events";
import { realtimeStatusPredicate } from "./realtime-sessions";
import { activeBatchReservationPredicate } from "./wallet-reservations";

const dialect = new PgDialect();

describe("scheduled repository list predicates", () => {
	it.each([
		[providerEventsPredicate(["openai", "google"]), "provider in ($1, $2)", ["openai", "google"]],
		[reconciliationStatusPredicate(["queued", "running"]), "coalesce(status, '') in ($1, $2)", ["queued", "running"]],
		[realtimeStatusPredicate(["connected", "ending"]), "status in ($1, $2)", ["connected", "ending"]],
		[activeBatchReservationPredicate(), "reservation.status in ($1, $2)", ["held", "reserved"]],
	] as const)("expands list values for %s", (predicate, expectedSql, expectedParams) => {
		const query = dialect.sqlToQuery(predicate);

		expect(query.sql).toBe(expectedSql);
		expect(query.params).toEqual(expectedParams);
	});

	it("omits the reconciliation status filter when every status is allowed", () => {
		const query = dialect.sqlToQuery(reconciliationStatusPredicate(null));

		expect(query.sql).toBe("true");
		expect(query.params).toEqual([]);
	});
});
