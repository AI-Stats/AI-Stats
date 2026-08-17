import { sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

export type VideoGatewayRequestRow = {
	id: string;
	created_at: string;
	usage: Record<string, unknown> | null;
	pricing_lines: unknown[] | null;
};

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

export async function findLatestVideoGatewayRequest(workspaceId: string, requestId: string): Promise<VideoGatewayRequestRow | null> {
	return withDatabase(async (db) => (await db.execute<VideoGatewayRequestRow>(sql`
		select id,created_at,usage,pricing_lines
		from observability.gateway_requests
		where workspace_id=${workspaceId}::uuid and request_id=${requestId}
		order by created_at desc
		limit 1
	`))[0] ?? null);
}

export async function updateVideoGatewayRequest(args: {
	id: string;
	workspaceId: string;
	usage: Record<string, unknown>;
	costNanos: number | null;
	generationMs: number | null;
	pricingLines: unknown[];
}): Promise<boolean> {
	return withDatabase(async (db) => {
		const rows = await db.execute<{ id: string }>(sql`
			update observability.gateway_requests set
				usage=${JSON.stringify(args.usage)}::jsonb,
				cost_nanos=case when ${args.costNanos}::bigint is null then cost_nanos else ${args.costNanos}::bigint end,
				generation_ms=case when ${args.generationMs}::integer is null then generation_ms else ${args.generationMs}::integer end,
				pricing_lines=${JSON.stringify(args.pricingLines)}::jsonb
			where id=${args.id}::uuid and workspace_id=${args.workspaceId}::uuid
			returning id
		`);
		return rows.length > 0;
	});
}
