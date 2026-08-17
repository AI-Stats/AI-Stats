import { sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

async function withDatabase<T>(operation: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
	const { db, client } = createDatabase(getBindings());
	try { return await operation(db); } finally { await client.end({ timeout: 1 }); }
}

const identifier = /^[a-z_][a-z0-9_]*$/;

function insertStatement(table: "gateway_requests", row: Record<string, unknown>, returning = false) {
	const entries = Object.entries(row).filter(([key, value]) => value !== undefined && identifier.test(key));
	if (!entries.length) throw new Error(`audit_${table}_empty_insert`);
	const columns = sql.join(entries.map(([key]) => sql.raw(`"${key}"`)), sql`, `);
	const values = sql.join(entries.map(([, value]) => value !== null && typeof value === "object"
		? sql`${JSON.stringify(value)}::jsonb`
		: sql`${value}`), sql`, `);
	return sql`insert into ${sql.raw(table)} (${columns}) values (${values}) ${returning ? sql`returning id::text, created_at::text, workspace_id::text` : sql``}`;
}

export async function insertGatewayRequest(row: Record<string, unknown>) {
	return withDatabase(async (db) => ([...await db.execute<{ id: string; created_at: string; workspace_id: string }>(
		insertStatement("gateway_requests", row, true),
	)])[0]);
}

type IngestIdentity = { request_event_id: string; routed_model_slug: string | null; provider_model_id: string | null; occurred_at: string };

export async function ingestV2GatewayRequest(event: Record<string, unknown>): Promise<string> {
	const attempts = Array.isArray(event.attempts) ? event.attempts : [];
	const usage = Array.isArray(event.usage_meters) ? event.usage_meters : [];
	const pricing = Array.isArray(event.pricing_lines) ? event.pricing_lines : [];
	const routing = Array.isArray(event.routing_decisions) ? event.routing_decisions : [];
	if (!event.workspace_id || !String(event.request_id ?? "").trim() || !String(event.requested_model_input ?? "").trim()) throw new Error("gateway_event_missing_identity");
	if (attempts.length > 128) throw new Error("gateway_event_attempts_invalid");
	if (usage.length > 256) throw new Error("gateway_event_usage_invalid");
	if (pricing.length > 256) throw new Error("gateway_event_pricing_invalid");
	if (routing.length > 128) throw new Error("gateway_event_routing_decisions_invalid");
	const encoded = JSON.stringify(event);
	return withDatabase((db) => db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${event.workspace_id}:${event.request_id}`},0))`);
		const identities = [...await tx.execute<IngestIdentity>(sql`
			with input as (select ${encoded}::jsonb e), resolved as (
				select e,
					coalesce((select model_slug from v2_models where model_slug=lower(e->>'requested_model_input') limit 1),
						(select model_slug from v2_model_aliases where alias_slug=lower(e->>'requested_model_input') and enabled=true limit 1)) requested_model_slug
				from input
			), routed as (
				select e,requested_model_slug,coalesce((select model_slug from v2_models where model_slug=lower(coalesce(nullif(trim(e->>'routed_model_slug'),''),requested_model_slug,e->>'requested_model_input')) limit 1),requested_model_slug) routed_model_slug
				from resolved
			), route as (
				select e,requested_model_slug,routed_model_slug,coalesce(
					(select provider_model_id from v2_model_provider_routes where provider_model_id=nullif(trim(e->>'provider_model_id'),'') limit 1),
					(select provider_model_id from v2_model_provider_routes r where r.provider_slug=nullif(trim(e->>'provider'),'') and (routed_model_slug is null or r.model_slug=routed_model_slug)
					 order by case when nullif(trim(e->>'provider_api_model_id'),'') is not null and r.provider_model_slug=e->>'provider_api_model_id' then 0
					 when nullif(trim(e->>'provider_api_model_id'),'') is not null and r.provider_model_id=(e->>'provider')||':'||(e->>'provider_api_model_id') then 1 else 2 end,
					 case when r.routing_enabled then 0 else 1 end,r.provider_model_id limit 1)) provider_model_id
				from routed
			)
			insert into v2_request_facts (workspace_id,request_id,occurred_at,app_id,key_id,endpoint,requested_model_input,requested_model_slug,routed_model_slug,provider_model_id,status_code,success,error_code,stop_reason,tool_call_count,tool_call_succeeded,structured_output_attempted,structured_output_succeeded,stream,byok,latency_ms,time_to_first_token_ms,generation_ms,internal_dispatch_ms,gateway_total_ms,upstream_attempt_count,throughput,user_agent,session_id,end_user_id,auth_method,native_response_id,cost_nanos,currency,cloudflare_colo,safe_metadata)
			select nullif(e->>'workspace_id','')::uuid,nullif(trim(e->>'request_id'),''),coalesce(nullif(e->>'occurred_at','')::timestamptz,now()),nullif(e->>'app_id','')::uuid,nullif(e->>'key_id','')::uuid,
				coalesce(nullif(trim(e->>'endpoint'),''),'unknown'),nullif(trim(e->>'requested_model_input'),''),requested_model_slug,routed_model_slug,provider_model_id,
				nullif(e->>'status_code','')::integer,coalesce((e->>'success')::boolean,false),nullif(e->>'error_code',''),nullif(e->>'stop_reason',''),greatest(0,coalesce((e->>'tool_call_count')::integer,0)),
				case when coalesce((e->>'tool_call_count')::integer,0)>0 then (e->>'tool_call_succeeded')::boolean else null end,coalesce((e->>'structured_output_attempted')::boolean,false),coalesce((e->>'structured_output_succeeded')::boolean,false),
				coalesce((e->>'stream')::boolean,false),coalesce((e->>'byok')::boolean,false),nullif(e->>'latency_ms','')::integer,nullif(e->>'latency_ms','')::integer,nullif(e->>'generation_ms','')::integer,
				nullif(e->>'internal_dispatch_ms','')::numeric,nullif(e->>'gateway_total_ms','')::numeric,least(32767,jsonb_array_length(coalesce(e->'attempts','[]'::jsonb)))::smallint,nullif(e->>'throughput','')::numeric,
				left(nullif(e->>'user_agent',''),1024),left(nullif(e->>'session_id',''),256),left(nullif(e->>'end_user_id',''),256),nullif(e->>'auth_method',''),left(nullif(e->>'native_response_id',''),512),
				nullif(e->>'cost_nanos','')::bigint,left(nullif(e->>'currency',''),8),nullif(upper(trim(e->>'cloudflare_colo')),''),coalesce(e->'safe_metadata','{}'::jsonb)
			from route on conflict (workspace_id,request_id) do update set occurred_at=excluded.occurred_at,app_id=excluded.app_id,key_id=excluded.key_id,endpoint=excluded.endpoint,requested_model_input=excluded.requested_model_input,
				requested_model_slug=excluded.requested_model_slug,routed_model_slug=excluded.routed_model_slug,provider_model_id=excluded.provider_model_id,status_code=excluded.status_code,success=excluded.success,error_code=excluded.error_code,
				stop_reason=excluded.stop_reason,tool_call_count=excluded.tool_call_count,tool_call_succeeded=excluded.tool_call_succeeded,structured_output_attempted=excluded.structured_output_attempted,
				structured_output_succeeded=excluded.structured_output_succeeded,stream=excluded.stream,byok=excluded.byok,latency_ms=excluded.latency_ms,time_to_first_token_ms=excluded.time_to_first_token_ms,
				generation_ms=excluded.generation_ms,internal_dispatch_ms=excluded.internal_dispatch_ms,gateway_total_ms=excluded.gateway_total_ms,upstream_attempt_count=excluded.upstream_attempt_count,throughput=excluded.throughput,
				user_agent=excluded.user_agent,session_id=excluded.session_id,end_user_id=excluded.end_user_id,auth_method=excluded.auth_method,native_response_id=excluded.native_response_id,cost_nanos=excluded.cost_nanos,currency=excluded.currency,
				cloudflare_colo=excluded.cloudflare_colo,safe_metadata=excluded.safe_metadata
			returning request_event_id::text,(select routed_model_slug from route),(select provider_model_id from route),occurred_at::text
		`)];
		const identity = identities[0];
		if (!identity) throw new Error("gateway_event_fact_upsert_failed");
		const eventId = identity.request_event_id;

		await tx.execute(sql`delete from v2_request_attempts where request_event_id=${eventId}::uuid`);
		await tx.execute(sql`
			insert into v2_request_attempts (request_event_id,attempt_number,provider_model_id,status_code,success,error_code,failure_class,upstream_response_id,latency_ms,cloudflare_colo,safe_metadata)
			select ${eventId}::uuid,greatest(1,coalesce((item.value->>'attempt_number')::integer,item.ordinality::integer)),route.provider_model_id,nullif(item.value->>'status_code','')::integer,
				coalesce((item.value->>'success')::boolean,false),nullif(item.value->>'error_code',''),nullif(item.value->>'failure_class',''),left(nullif(item.value->>'upstream_response_id',''),512),
				nullif(item.value->>'latency_ms','')::integer,nullif(upper(trim(${String(event.cloudflare_colo ?? "")})),''),jsonb_strip_nulls(jsonb_build_object('provider',nullif(item.value->>'provider',''),
				'credential_phase',nullif(item.value->>'credential_phase',''),'key_source',nullif(item.value->>'key_source',''),'response_kind',nullif(item.value->>'response_kind',''),
				'retryable',nullif(item.value->>'retryable','')::boolean,'was_probe',coalesce((item.value->>'was_probe')::boolean,false)))
			from jsonb_array_elements(${JSON.stringify(attempts)}::jsonb) with ordinality item(value,ordinality)
			left join lateral (select provider_model_id from v2_model_provider_routes candidate where candidate.provider_model_id=nullif(item.value->>'provider_model_id','')
				or (candidate.provider_slug=nullif(item.value->>'provider','') and (candidate.provider_model_id=nullif(item.value->>'provider','')||':'||nullif(item.value->>'provider_api_model_id','') or candidate.provider_model_slug=nullif(item.value->>'provider_api_model_id','')))
				order by case when candidate.provider_model_id=nullif(item.value->>'provider_model_id','') then 0 else 1 end,candidate.provider_model_id limit 1) route on true
		`);

		await tx.execute(sql`delete from v2_request_usage where request_event_id=${eventId}::uuid`);
		await tx.execute(sql`
			insert into v2_request_usage (request_event_id,sku_meter_id,meter_key,modality,unit,quantity,source,billable,sequence)
			select ${eventId}::uuid,meter.sku_meter_id,lower(item.value->>'meter_key'),lower(item.value->>'modality'),lower(item.value->>'unit'),greatest(0,(item.value->>'quantity')::numeric),
				coalesce(nullif(item.value->>'source',''),'gateway'),coalesce((item.value->>'billable')::boolean,true),greatest(0,coalesce((item.value->>'sequence')::integer,item.ordinality::integer-1))
			from jsonb_array_elements(${JSON.stringify(usage)}::jsonb) with ordinality item(value,ordinality)
			left join lateral (select sm.sku_meter_id from v2_pricing_sku_meters sm join v2_pricing_skus s on s.sku_id=sm.sku_id where s.provider_model_id=${identity.provider_model_id} and sm.meter_key=lower(item.value->>'meter_key')
				and s.status='active' and s.effective_from<=${identity.occurred_at}::timestamptz and (s.effective_to is null or s.effective_to>${identity.occurred_at}::timestamptz) order by s.version desc,s.effective_from desc limit 1) meter on true
			where coalesce((item.value->>'quantity')::numeric,0)>0
		`);

		await tx.execute(sql`delete from v2_request_pricing_lines where request_event_id=${eventId}::uuid`);
		await tx.execute(sql`
			insert into v2_request_pricing_lines (request_event_id,sku_id,sku_meter_id,meter_key,quantity,unit,unit_price_nanos,charged_nanos)
			select ${eventId}::uuid,meter.sku_id,meter.sku_meter_id,lower(item.value->>'meter_key'),greatest(0,(item.value->>'quantity')::numeric),lower(coalesce(nullif(item.value->>'unit',''),'unit')),
				greatest(0,coalesce((item.value->>'unit_price_nanos')::numeric,0)),greatest(0,coalesce((item.value->>'charged_nanos')::bigint,0))
			from jsonb_array_elements(${JSON.stringify(pricing)}::jsonb) item(value)
			left join lateral (select s.sku_id,sm.sku_meter_id from v2_pricing_skus s left join v2_pricing_sku_meters sm on sm.sku_id=s.sku_id and sm.meter_key=lower(item.value->>'meter_key')
				where s.provider_model_id=${identity.provider_model_id} and s.status='active' and s.effective_from<=${identity.occurred_at}::timestamptz and (s.effective_to is null or s.effective_to>${identity.occurred_at}::timestamptz) order by s.version desc,s.effective_from desc limit 1) meter on true
		`);

		await tx.execute(sql`delete from v2_request_routing_decisions where request_event_id=${eventId}::uuid`);
		await tx.execute(sql`
			insert into v2_request_routing_decisions (request_event_id,decision_order,provider_model_id,provider_slug,provider_api_model_id,decision,rank,score,selected,attempted,breaker,breaker_until,provider_status,provider_routing_status,model_routing_status,capability_status,exclusion_stage,exclusion_reason,score_factors)
			select ${eventId}::uuid,greatest(1,coalesce((item.value->>'decision_order')::integer,item.ordinality::integer)),route.provider_model_id,left(nullif(trim(item.value->>'provider'),''),256),
				left(nullif(trim(item.value->>'provider_api_model_id'),''),512),coalesce(nullif(item.value->>'decision',''),'ranked'),nullif(item.value->>'rank','')::integer,nullif(item.value->>'score','')::numeric,
				coalesce((item.value->>'selected')::boolean,false),coalesce((item.value->>'attempted')::boolean,false),left(nullif(item.value->>'breaker',''),64),
				case when nullif(item.value->>'breaker_until_ms','') is null then null else to_timestamp((item.value->>'breaker_until_ms')::double precision/1000.0) end,
				left(nullif(item.value->>'provider_status',''),64),left(nullif(item.value->>'provider_routing_status',''),64),left(nullif(item.value->>'model_routing_status',''),64),left(nullif(item.value->>'capability_status',''),64),
				left(nullif(item.value->>'exclusion_stage',''),128),left(nullif(item.value->>'exclusion_reason',''),256),coalesce(item.value->'score_factors','{}'::jsonb)
			from jsonb_array_elements(${JSON.stringify(routing)}::jsonb) with ordinality item(value,ordinality)
			left join lateral (select provider_model_id from v2_model_provider_routes candidate where candidate.provider_model_id=nullif(item.value->>'provider_model_id','')
				or (candidate.provider_slug=nullif(item.value->>'provider','') and (candidate.provider_model_id=nullif(item.value->>'provider','')||':'||nullif(item.value->>'provider_api_model_id','') or candidate.provider_model_slug=nullif(item.value->>'provider_api_model_id','')))
				order by case when candidate.provider_model_id=nullif(item.value->>'provider_model_id','') then 0 else 1 end,candidate.provider_model_id limit 1) route on true
			where nullif(trim(item.value->>'provider'),'') is not null
		`);
		await tx.execute(sql`
			insert into v2_analytics_outbox (request_event_id,workspace_id,occurred_at,status,attempt_count,available_at,last_error,updated_at)
			select request_event_id,workspace_id,occurred_at,'pending',0,now(),null,now() from v2_request_facts where request_event_id=${eventId}::uuid
			on conflict (request_event_id) do update set workspace_id=excluded.workspace_id,occurred_at=excluded.occurred_at,status='pending',attempt_count=0,available_at=now(),last_error=null,updated_at=now()
		`);
		return eventId;
	}));
}
