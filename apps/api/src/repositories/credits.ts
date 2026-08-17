import { creditLedger, gatewayRequests, wallets } from "@phaseo/db/schema";
import { and, desc, eq, gte } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function loadCreditsSummary(workspaceId: string, since: string) {
	return withDatabase(async (db) => {
		const [wallet, ledger, requestCount] = await Promise.all([
			db.query.wallets.findFirst({ columns: { balanceNanos: true, reservedNanos: true }, where: eq(wallets.workspaceId, workspaceId) }),
			db.select({ amountNanos: creditLedger.amountNanos }).from(creditLedger)
				.where(and(eq(creditLedger.workspaceId, workspaceId), gte(creditLedger.createdAt, since))),
			db.$count(gatewayRequests, and(eq(gatewayRequests.workspaceId, workspaceId), gte(gatewayRequests.createdAt, since))),
		]);
		return { wallet: wallet ?? null, ledger, requestCount };
	});
}

export async function loadWorkspaceActivity(args: { workspaceId: string; since: string; limit: number; offset: number }) {
	return withDatabase(async (db) => {
		const where = and(eq(gatewayRequests.workspaceId, args.workspaceId), gte(gatewayRequests.createdAt, args.since));
		const [rows, total] = await Promise.all([
			db.select({
				request_id: gatewayRequests.requestId, provider: gatewayRequests.provider,
				model_id: gatewayRequests.modelId, endpoint: gatewayRequests.endpoint,
				usage: gatewayRequests.usage, cost_nanos: gatewayRequests.costNanos,
				created_at: gatewayRequests.createdAt, latency_ms: gatewayRequests.latencyMs,
			}).from(gatewayRequests).where(where).orderBy(desc(gatewayRequests.createdAt)).limit(args.limit).offset(args.offset),
			db.$count(gatewayRequests, where),
		]);
		return { rows, total };
	});
}
