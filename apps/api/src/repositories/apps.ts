import { apiApps } from "@phaseo/db/schema";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

export async function upsertLoggingApp(values: typeof apiApps.$inferInsert): Promise<string> {
	const { db, client } = createDatabase(getBindings());
	try {
		const [row] = await db.insert(apiApps).values(values).onConflictDoUpdate({
			target: [apiApps.workspaceId, apiApps.appKey],
			set: {
				title: values.title,
				url: values.url,
				isActive: true,
				lastSeen: values.lastSeen,
				updatedAt: values.updatedAt,
				meta: values.meta,
			},
		}).returning({ id: apiApps.id });
		if (!row) throw new Error("logging_app_upsert_returned_no_row");
		return row.id;
	} finally {
		await client.end({ timeout: 1 });
	}
}
