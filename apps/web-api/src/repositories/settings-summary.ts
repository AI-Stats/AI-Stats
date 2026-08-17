import { v2RequestFacts } from "@phaseo/db/schema";
import { sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function getPreviousMonthSpendCents(env: Env, workspaceId: string) {
	const { db, client } = createDatabase(env);
	try { const [row] = await db.execute<Record<string, unknown>>(sql`
		select floor(coalesce(sum(cost_nanos),0)::numeric/10000000)::bigint cents from ${v2RequestFacts}
		where workspace_id=${workspaceId}::uuid and success=true
		and occurred_at>=date_trunc('month',now() at time zone 'utc')-interval '1 month'
		and occurred_at<date_trunc('month',now() at time zone 'utc')
	`); return Number(row?.cents ?? 0); } finally { await client.end({ timeout: 1 }); }
}

export async function getWorkspaceKeyUsage(env: Env, workspaceId: string, dayStart: string) {
	const { db, client } = createDatabase(env);
	try { const rows = await db.execute<Record<string, unknown>>(sql`
		select key_id,
			count(*) filter(where occurred_at>=${dayStart}::timestamptz)::bigint daily_request_count,
			count(*) filter(where occurred_at>=date_trunc('week',now() at time zone 'utc'))::bigint weekly_request_count,
			count(*) filter(where occurred_at>=date_trunc('month',now() at time zone 'utc'))::bigint monthly_request_count,
			coalesce(sum(cost_nanos) filter(where occurred_at>=${dayStart}::timestamptz),0)::bigint daily_cost_nanos,
			coalesce(sum(cost_nanos) filter(where occurred_at>=date_trunc('week',now() at time zone 'utc')),0)::bigint weekly_cost_nanos,
			coalesce(sum(cost_nanos) filter(where occurred_at>=date_trunc('month',now() at time zone 'utc')),0)::bigint monthly_cost_nanos,
			max(occurred_at) last_used_at
		from ${v2RequestFacts} where workspace_id=${workspaceId}::uuid and key_id is not null and success=true group by key_id
	`); return [...rows]; } finally { await client.end({ timeout: 1 }); }
}
