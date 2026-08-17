import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
	analyticsOutboxMeterTable,
	analyticsOutboxRequestIdsPredicate,
	pendingAnalyticsOutboxPredicate,
} from "./analytics-outbox";

const dialect = new PgDialect();

describe("analytics outbox predicates", () => {
	it("expands request IDs as individual parameters", () => {
		const query = dialect.sqlToQuery(
			analyticsOutboxRequestIdsPredicate(["request-1", "request-2"]),
		);

		expect(query.sql).toBe("request_event_id in ($1, $2)");
		expect(query.params).toEqual(["request-1", "request-2"]);
	});

	it("expands pending statuses instead of binding a PostgreSQL array", () => {
		const query = dialect.sqlToQuery(pendingAnalyticsOutboxPredicate());

		expect(query.sql).toBe("outbox.status in ($1, $2)");
		expect(query.params).toEqual(["pending", "failed"]);
	});

	it.each([
		["private", "observability.v2_private_usage_daily_meters"],
		["daily", "observability.v2_public_usage_daily_meters"],
		["hourly", "observability.v2_public_usage_hourly_meters"],
	] as const)("qualifies %s meter writes with the observability schema", (kind, expected) => {
		const query = dialect.sqlToQuery(analyticsOutboxMeterTable(kind));

		expect(query.sql).toBe(expected);
		expect(query.params).toEqual([]);
	});
});
