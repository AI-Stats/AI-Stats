import { gatewayAsyncOperations, v2ModelProviderRoutes, v2RequestFacts, v2RequestUsage } from "@phaseo/db/schema";
import { sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function getUsageChartRollup(env: Env, input: { workspaceId: string; from: string; to: string; bucket: string; keyId?: string | null }) {
	const { db, client } = createDatabase(env); try { const rows = await db.execute<Record<string, unknown>>(sql`
		with usage as (select request_event_id,sum(quantity) filter(where meter_key in ('input_tokens','output_tokens','input_text_tokens','output_text_tokens','input_image_tokens','output_image_tokens','input_audio_tokens','output_audio_tokens','input_video_tokens','output_video_tokens')) tokens from ${v2RequestUsage} group by request_event_id), base as (
			select fact.occurred_at,coalesce(nullif(fact.safe_metadata->>'provider',''),route.provider_slug,'unknown') provider,coalesce(nullif(fact.routed_model_slug,''),nullif(fact.requested_model_slug,''),nullif(fact.requested_model_input,''),'unknown') model_id,coalesce(usage.tokens,0) tokens,coalesce(fact.cost_nanos,0) cost_nanos
			from ${v2RequestFacts} fact left join ${v2ModelProviderRoutes} route on route.provider_model_id=fact.provider_model_id left join usage on usage.request_event_id=fact.request_event_id
			where fact.workspace_id=${input.workspaceId}::uuid and fact.success=true and fact.occurred_at>=${input.from}::timestamptz and fact.occurred_at<=${input.to}::timestamptz and (${input.keyId ?? null}::uuid is null or fact.key_id=${input.keyId ?? null}::uuid)
		), bucketed as (select case when ${input.bucket}='5min' then date_trunc('minute',occurred_at)-make_interval(mins=>(extract(minute from occurred_at)::int%5)) when ${input.bucket}='hour' then date_trunc('hour',occurred_at) when ${input.bucket}='month' then date_trunc('month',occurred_at) else date_trunc('day',occurred_at) end bucket,provider,model_id,tokens,cost_nanos::numeric/1e9 cost from base)
		select bucket,provider,model_id,count(*)::bigint requests,sum(tokens)::bigint tokens,sum(cost)::numeric cost from bucketed group by bucket,provider,model_id order by bucket
	`); return [...rows]; } finally { await client.end({ timeout: 1 }); }
}

export async function getSessionRollups(env: Env, input: { workspaceId: string; from: string; to: string; limit: number; offset: number; sessionId?: string | null; appId?: string | null; modelId?: string | null; provider?: string | null }) {
	const { db, client } = createDatabase(env); try { const rows = await db.execute<Record<string, unknown>>(sql`
		with filtered as (select fact.*,coalesce(nullif(fact.safe_metadata->>'provider',''),route.provider_slug) provider,coalesce(nullif(fact.routed_model_slug,''),nullif(fact.requested_model_slug,''),nullif(fact.requested_model_input,'')) model_id from ${v2RequestFacts} fact left join ${v2ModelProviderRoutes} route on route.provider_model_id=fact.provider_model_id where fact.workspace_id=${input.workspaceId}::uuid and fact.occurred_at>=${input.from}::timestamptz and fact.occurred_at<=${input.to}::timestamptz and nullif(trim(fact.session_id),'') is not null and (${input.sessionId ?? null}::text is null or fact.session_id=${input.sessionId ?? null}) and (${input.appId ?? null}::uuid is null or fact.app_id=${input.appId ?? null}::uuid) and (${input.modelId ?? null}::text is null or coalesce(nullif(fact.routed_model_slug,''),nullif(fact.requested_model_slug,''),nullif(fact.requested_model_input,''))=${input.modelId ?? null}) and (${input.provider ?? null}::text is null or coalesce(nullif(fact.safe_metadata->>'provider',''),route.provider_slug)=${input.provider ?? null}))
		select session_id,count(*)::bigint request_count,coalesce(sum(cost_nanos),0)::numeric total_cost_nanos,coalesce(sum(cost_nanos),0)::numeric/1e9 total_cost_usd,min(occurred_at) first_request_at,max(occurred_at) last_request_at,array_remove(array_agg(distinct app_id),null) app_ids,array_remove(array_agg(distinct model_id),null) model_ids,array_remove(array_agg(distinct provider),null) provider_ids,array_remove(array_agg(distinct end_user_id),null) end_user_ids from filtered group by session_id order by last_request_at desc limit ${Math.max(1, Math.min(input.limit, 500))} offset ${Math.max(0, input.offset)}
	`); return [...rows]; } finally { await client.end({ timeout: 1 }); }
}

export async function getJobsRollup(env: Env, input: { workspaceId: string; limit: number; offset: number; kind?: string | null; status?: string | null; sessionId?: string | null; provider?: string | null }) {
	const { db, client } = createDatabase(env); try { const rows = await db.execute<Record<string, unknown>>(sql`
		with requests as (select fact.*,row_number() over(partition by workspace_id,request_id order by occurred_at desc) rn from ${v2RequestFacts} fact where workspace_id=${input.workspaceId}::uuid)
		select operation.id job_id,operation.kind,operation.internal_id,operation.request_id,operation.session_id,operation.app_id,operation.provider,operation.model,operation.status,operation.billed_at,operation.created_at,operation.updated_at,request.occurred_at request_created_at,request.endpoint request_endpoint,coalesce(request.routed_model_slug,request.requested_model_slug,request.requested_model_input) request_model_id,request.cost_nanos request_cost_nanos,coalesce(request.cost_nanos,0)::numeric/1e9 request_cost_usd
		from ${gatewayAsyncOperations} operation left join requests request on request.workspace_id=operation.workspace_id and request.request_id=operation.request_id and request.rn=1
		where operation.workspace_id=${input.workspaceId}::uuid and (${input.kind ?? null}::text is null or operation.kind=${input.kind ?? null}) and (${input.status ?? null}::text is null or operation.status=${input.status ?? null}) and (${input.sessionId ?? null}::text is null or operation.session_id=${input.sessionId ?? null}) and (${input.provider ?? null}::text is null or operation.provider=${input.provider ?? null})
		order by operation.updated_at desc limit ${Math.max(1, Math.min(input.limit, 500))} offset ${Math.max(0, input.offset)}
	`); return [...rows]; } finally { await client.end({ timeout: 1 }); }
}
