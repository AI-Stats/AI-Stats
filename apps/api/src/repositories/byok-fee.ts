import { workspaceByokMonthlyUsage } from "@phaseo/db/schema";
import { sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

export async function incrementMonthlyRequestCount(workspaceId: string, nowIso: string) {
	const { db, client } = createDatabase(getBindings());
	try {
		const rows = await db.insert(workspaceByokMonthlyUsage).values({
			workspaceId,
			monthStart: sql`date_trunc('month', ${nowIso}::timestamptz at time zone 'UTC') at time zone 'UTC'`,
			requestCount: 1,
		}).onConflictDoUpdate({
			target: [workspaceByokMonthlyUsage.workspaceId, workspaceByokMonthlyUsage.monthStart],
			set: { requestCount: sql`${workspaceByokMonthlyUsage.requestCount} + 1`, updatedAt: new Date().toISOString() },
		}).returning({ month_start: workspaceByokMonthlyUsage.monthStart, request_count: workspaceByokMonthlyUsage.requestCount });
		if (!rows[0]) throw new Error("byok_counter_increment_missing");
		return rows[0];
	} finally { await client.end({ timeout: 1 }); }
}
