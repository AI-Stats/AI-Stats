import { v2RequestFacts, v2RequestUsage } from "@phaseo/db/schema";
import { sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function getPrivateGeographyUsage(env: Env, workspaceId: string, from: string, to: string) {
	const { db, client } = createDatabase(env);
	try { const rows = await db.execute<Record<string, unknown>>(sql`
		with facts as materialized (
			select request_event_id,edge_country,edge_continent,cost_nanos,success,latency_ms from ${v2RequestFacts}
			where workspace_id=${workspaceId}::uuid and occurred_at>=${from}::timestamptz and occurred_at<${to}::timestamptz and edge_country is not null
		), tokens as (
			select fact.request_event_id,coalesce(nullif(sum(usage.quantity) filter(where usage.meter_key in ('input_tokens','output_tokens')),0),sum(usage.quantity) filter(where usage.meter_key in ('input_text_tokens','output_text_tokens','input_image_tokens','output_image_tokens','input_audio_tokens','output_audio_tokens','input_video_tokens','output_video_tokens')),0) tokens
			from facts fact left join ${v2RequestUsage} usage on usage.request_event_id=fact.request_event_id group by fact.request_event_id
		)
		select fact.edge_country country_code,max(fact.edge_continent) continent_code,count(*)::bigint requests,coalesce(sum(tokens.tokens),0) tokens,coalesce(sum(fact.cost_nanos),0)::numeric spend_nanos,count(*) filter(where fact.success)::bigint successes,avg(fact.latency_ms)::numeric average_latency_ms
		from facts fact left join tokens on tokens.request_event_id=fact.request_event_id group by fact.edge_country order by count(*) desc,fact.edge_country
	`); return [...rows]; } finally { await client.end({ timeout: 1 }); }
}

export async function getWorkspaceModelLastUsed(env: Env, workspaceId: string, since: string) {
	const { db, client } = createDatabase(env);
	try { const rows = await db.execute<Record<string, unknown>>(sql`
		select coalesce(nullif(routed_model_slug,''),nullif(requested_model_slug,''),nullif(requested_model_input,'')) model_id,max(occurred_at) last_used_at
		from ${v2RequestFacts} where workspace_id=${workspaceId}::uuid and occurred_at>=${since}::timestamptz
		and coalesce(nullif(routed_model_slug,''),nullif(requested_model_slug,''),nullif(requested_model_input,'')) is not null
		group by 1 order by 2 desc
	`); return [...rows]; } finally { await client.end({ timeout: 1 }); }
}
