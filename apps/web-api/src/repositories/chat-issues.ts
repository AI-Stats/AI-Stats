import { sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function reserveChatIssueReport(env: Env, input: { userId: string; issueFingerprint: string; modelId: string; requestId: string | null }) {
	const { db, client } = createDatabase(env);
	try {
		return await db.transaction(async (tx) => {
			await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.userId}))`);
			const [counts] = await tx.execute<Record<string, unknown>>(sql`
				select count(*) filter(where created_at>=now()-interval '1 hour')::integer hour_count,
					count(*) filter(where created_at>=now()-interval '1 day')::integer day_count,
					min(created_at) filter(where created_at>=now()-interval '1 hour') hour_start,
					min(created_at) filter(where created_at>=now()-interval '1 day') day_start
				from chat_issue_reports where user_id=${input.userId}::uuid
			`);
			const hourCount = Number(counts?.hour_count ?? 0); const dayCount = Number(counts?.day_count ?? 0);
			if (hourCount >= 3 || dayCount >= 10) {
				const start = new Date(String(hourCount >= 3 ? counts?.hour_start : counts?.day_start)).getTime();
				const windowMs = hourCount >= 3 ? 3_600_000 : 86_400_000;
				return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(60, Math.ceil((start + windowMs - Date.now()) / 1000)) };
			}
			await tx.execute(sql`insert into chat_issue_reports(user_id,issue_fingerprint,model_id,request_id) values(${input.userId}::uuid,${input.issueFingerprint.slice(0,500)},${input.modelId},${input.requestId})`);
			return { allowed: true, remaining: Math.max(Math.min(3-hourCount-1,10-dayCount-1),0), retryAfterSeconds: null };
		});
	} finally { await client.end({ timeout: 1 }); }
}
