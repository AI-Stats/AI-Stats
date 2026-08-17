import { gatewayProviderHealthStates, gatewayRequests } from "@phaseo/db/schema";
import { and, desc, eq, gte } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

export async function listRecentProviderRequestTuples(args: {
	providerId: string;
	since: string;
	limit: number;
}) {
	const { db, client } = createDatabase(getBindings());
	try {
		return await db.select({
			model_id: gatewayRequests.modelId,
			endpoint: gatewayRequests.endpoint,
			created_at: gatewayRequests.createdAt,
		}).from(gatewayRequests).where(and(
			eq(gatewayRequests.provider, args.providerId),
			gte(gatewayRequests.createdAt, args.since),
		)).orderBy(desc(gatewayRequests.createdAt)).limit(args.limit).then((rows) =>
			rows.filter((row) => row && row.endpoint && row.model_id),
		);
	} finally {
		await client.end({ timeout: 1 });
	}
}

export async function upsertProviderHealthState(values: typeof gatewayProviderHealthStates.$inferInsert): Promise<void> {
	const { db, client } = createDatabase(getBindings());
	try {
		await db.insert(gatewayProviderHealthStates).values(values).onConflictDoUpdate({
			target: [gatewayProviderHealthStates.providerId, gatewayProviderHealthStates.modelId, gatewayProviderHealthStates.endpoint],
			set: {
				breakerState: values.breakerState,
				isDeranked: values.isDeranked,
				openUntilMs: values.openUntilMs,
				openUntil: values.openUntil,
				lastTransitionAt: values.lastTransitionAt,
				updatedAt: values.updatedAt,
				lastReason: values.lastReason,
			},
		});
	} finally {
		await client.end({ timeout: 1 });
	}
}
