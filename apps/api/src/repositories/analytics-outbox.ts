import { sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

type ClaimedFact = {
	request_event_id: string;
	workspace_id: string;
	occurred_at: string;
	usage_date: string;
	bucket_start: string;
	app_id: string | null;
	model_slug: string | null;
	provider_model_id: string | null;
	cloudflare_colo: string | null;
};

export type AnalyticsOutboxSummary = {
	selected: number;
	private_grains: number;
	public_daily_grains: number;
	public_hourly_grains: number;
};

type Grain = Pick<ClaimedFact, "app_id" | "model_slug" | "provider_model_id" | "cloudflare_colo"> & {
	workspace_id?: string;
	usage_date?: string;
	bucket_start?: string;
};

function distinctGrains(rows: ClaimedFact[], kind: "private" | "daily" | "hourly"): Grain[] {
	const grains = new Map<string, Grain>();
	for (const row of rows) {
		if (!row.model_slug) continue;
		const grain: Grain = {
			...(kind === "private" ? { workspace_id: row.workspace_id } : {}),
			...(kind === "hourly" ? { bucket_start: row.bucket_start } : { usage_date: row.usage_date }),
			app_id: row.app_id,
			model_slug: row.model_slug,
			provider_model_id: row.provider_model_id,
			cloudflare_colo: row.cloudflare_colo,
		};
		grains.set(JSON.stringify(grain), grain);
	}
	return [...grains.values()];
}

function grainFactPredicate(grain: Grain, kind: "private" | "daily" | "hourly") {
	const timePredicate = kind === "hourly"
		? sql`fact.occurred_at >= ${grain.bucket_start}::timestamptz and fact.occurred_at < ${grain.bucket_start}::timestamptz + interval '1 hour'`
		: sql`fact.occurred_at >= ${grain.usage_date}::date::timestamptz and fact.occurred_at < (${grain.usage_date}::date + 1)::timestamptz`;
	return sql`${timePredicate}
		and fact.app_id is not distinct from ${grain.app_id}::uuid
		and coalesce(fact.routed_model_slug, fact.requested_model_slug) = ${grain.model_slug}
		and fact.provider_model_id is not distinct from ${grain.provider_model_id}
		and fact.cloudflare_colo is not distinct from ${grain.cloudflare_colo}
		${kind === "private" ? sql`and fact.workspace_id = ${grain.workspace_id}::uuid` : sql``}`;
}

function aggregateSelect(grain: Grain, kind: "private" | "daily" | "hourly") {
	return sql`
		count(*), count(*) filter (where fact.success), count(*) filter (where not fact.success),
		count(*) filter (where fact.status_code = 429), coalesce(sum(fact.tool_call_count), 0),
		count(*) filter (where fact.tool_call_count > 0),
		count(*) filter (where fact.tool_call_count > 0 and fact.tool_call_succeeded is true),
		count(*) filter (where fact.structured_output_attempted),
		count(*) filter (where fact.structured_output_attempted and fact.structured_output_succeeded),
		coalesce(sum(fact.latency_ms), 0), count(fact.latency_ms),
		coalesce(sum(fact.generation_ms), 0), count(fact.generation_ms),
		coalesce(sum(fact.throughput), 0), count(fact.throughput),
		coalesce(sum(fact.gateway_total_ms), 0), count(fact.gateway_total_ms),
		coalesce(sum(fact.internal_dispatch_ms), 0), count(fact.internal_dispatch_ms),
		coalesce(sum(attempts.attempts), 0), coalesce(sum(attempts.failed_attempts), 0),
		coalesce(sum(usage.cached_input_tokens), 0), coalesce(sum(usage.input_tokens), 0),
		coalesce(sum(fact.cost_nanos), 0)
		from v2_request_facts fact
		left join lateral (
			select count(*)::bigint attempts,
				count(*) filter (where not attempt.success)::bigint failed_attempts
			from v2_request_attempts attempt where attempt.request_event_id = fact.request_event_id
		) attempts on true
		left join lateral (
			select coalesce(sum(meter.quantity) filter (where meter.meter_key='cached_input_tokens'),0) cached_input_tokens,
				coalesce(sum(meter.quantity) filter (where meter.meter_key='input_tokens'),0) input_tokens
			from v2_request_usage meter where meter.request_event_id = fact.request_event_id
		) usage on true
		where ${grainFactPredicate(grain, kind)}`;
}

const aggregateColumns = sql.raw(`requests, successful_requests, failed_requests, rate_limited_requests,
	tool_call_count, tool_call_requests, tool_call_successes, structured_output_attempts, structured_output_successes,
	latency_sum_ms, latency_count, generation_sum_ms, generation_count, throughput_sum, throughput_count,
	gateway_total_sum_ms, gateway_total_count, internal_dispatch_sum_ms, internal_dispatch_count,
	upstream_attempts, failed_upstream_attempts, cached_input_tokens, input_tokens, cost_nanos`);

async function rebuildGrain(tx: any, grain: Grain, kind: "private" | "daily" | "hourly") {
	let rollupId: string;
	if (kind === "private") {
		await tx.execute(sql`delete from v2_private_usage_daily where workspace_id=${grain.workspace_id}::uuid
			and usage_date=${grain.usage_date}::date and app_id is not distinct from ${grain.app_id}::uuid
			and model_slug=${grain.model_slug} and provider_model_id is not distinct from ${grain.provider_model_id}
			and cloudflare_colo is not distinct from ${grain.cloudflare_colo}`);
		const [row] = await tx.execute(sql`insert into v2_private_usage_daily
			(usage_date,workspace_id,app_id,model_slug,provider_model_id,cloudflare_colo,${aggregateColumns})
			select ${grain.usage_date}::date,${grain.workspace_id}::uuid,${grain.app_id}::uuid,${grain.model_slug},${grain.provider_model_id},${grain.cloudflare_colo},
			${aggregateSelect(grain, kind)} returning rollup_id`);
		rollupId = (row as { rollup_id: string }).rollup_id;
	} else if (kind === "daily") {
		await tx.execute(sql`delete from v2_public_usage_daily where usage_date=${grain.usage_date}::date
			and app_id is not distinct from ${grain.app_id}::uuid and model_slug=${grain.model_slug}
			and provider_model_id is not distinct from ${grain.provider_model_id}
			and cloudflare_colo is not distinct from ${grain.cloudflare_colo}`);
		const [row] = await tx.execute(sql`insert into v2_public_usage_daily
			(usage_date,app_id,model_slug,provider_model_id,cloudflare_colo,${aggregateColumns})
			select ${grain.usage_date}::date,${grain.app_id}::uuid,${grain.model_slug},${grain.provider_model_id},${grain.cloudflare_colo},
			${aggregateSelect(grain, kind)} returning rollup_id`);
		rollupId = (row as { rollup_id: string }).rollup_id;
	} else {
		await tx.execute(sql`delete from v2_public_usage_hourly where bucket_start=${grain.bucket_start}::timestamptz
			and app_id is not distinct from ${grain.app_id}::uuid and model_slug=${grain.model_slug}
			and provider_model_id is not distinct from ${grain.provider_model_id}
			and cloudflare_colo is not distinct from ${grain.cloudflare_colo}`);
		const [row] = await tx.execute(sql`insert into v2_public_usage_hourly
			(bucket_start,app_id,model_slug,provider_model_id,cloudflare_colo,${aggregateColumns})
			select ${grain.bucket_start}::timestamptz,${grain.app_id}::uuid,${grain.model_slug},${grain.provider_model_id},${grain.cloudflare_colo},
			${aggregateSelect(grain, kind)} returning rollup_id`);
		rollupId = (row as { rollup_id: string }).rollup_id;
	}

	const meterTable = sql.raw(kind === "private"
		? "v2_private_usage_daily_meters"
		: kind === "daily" ? "v2_public_usage_daily_meters" : "v2_public_usage_hourly_meters");
	await tx.execute(sql`insert into ${meterTable} (rollup_id,meter_key,modality,unit,quantity)
		select ${rollupId}::uuid,meter.meter_key,meter.modality,meter.unit,sum(meter.quantity)
		from v2_request_usage meter join v2_request_facts fact on fact.request_event_id=meter.request_event_id
		where ${grainFactPredicate(grain, kind)} group by meter.meter_key,meter.modality,meter.unit`);
}

export async function processAnalyticsOutbox(requestedLimit = 250): Promise<AnalyticsOutboxSummary> {
	const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : 250, 2000));
	const { db, client } = createDatabase(getBindings());
	try {
		return await db.transaction(async (tx) => {
			const claimed = [...await tx.execute<ClaimedFact>(sql`
				select outbox.request_event_id,fact.workspace_id,fact.occurred_at,
					fact.occurred_at::date::text usage_date,date_trunc('hour',fact.occurred_at)::text bucket_start,
					fact.app_id,coalesce(fact.routed_model_slug,fact.requested_model_slug) model_slug,
					fact.provider_model_id,fact.cloudflare_colo
				from v2_analytics_outbox outbox join v2_request_facts fact on fact.request_event_id=outbox.request_event_id
				where outbox.status=any(${["pending", "failed"]}::text[]) and outbox.available_at<=now()
				order by outbox.occurred_at,outbox.request_event_id for update of outbox skip locked limit ${limit}`)];
			if (!claimed.length) return { selected: 0, private_grains: 0, public_daily_grains: 0, public_hourly_grains: 0 };

			const ids = claimed.map((row) => row.request_event_id);
			await tx.execute(sql`update v2_analytics_outbox set status='processing',updated_at=now()
				where request_event_id=any(${ids}::uuid[])`);
			const privateGrains = distinctGrains(claimed, "private");
			const dailyGrains = distinctGrains(claimed, "daily");
			const hourlyGrains = distinctGrains(claimed, "hourly");
			for (const grain of privateGrains) await rebuildGrain(tx, grain, "private");
			for (const grain of dailyGrains) await rebuildGrain(tx, grain, "daily");
			for (const grain of hourlyGrains) await rebuildGrain(tx, grain, "hourly");

			await tx.execute(sql`insert into v2_rollup_refresh_state
				(rollup_name,bucket_start,last_started_at,last_completed_at,source_watermark,status,error_message,updated_at)
				select 'private_daily',date_trunc('day',occurred_at),now(),now(),max(occurred_at),'complete',null,now()
				from v2_request_facts where request_event_id=any(${ids}::uuid[]) group by date_trunc('day',occurred_at)
				on conflict (rollup_name,bucket_start) do update set last_started_at=excluded.last_started_at,
				last_completed_at=excluded.last_completed_at,source_watermark=excluded.source_watermark,status='complete',error_message=null,updated_at=now()`);
			await tx.execute(sql`insert into v2_rollup_refresh_state
				(rollup_name,bucket_start,last_started_at,last_completed_at,source_watermark,status,error_message,updated_at)
				select 'public_hourly',date_trunc('hour',occurred_at),now(),now(),max(occurred_at),'complete',null,now()
				from v2_request_facts where request_event_id=any(${ids}::uuid[]) group by date_trunc('hour',occurred_at)
				on conflict (rollup_name,bucket_start) do update set last_started_at=excluded.last_started_at,
				last_completed_at=excluded.last_completed_at,source_watermark=excluded.source_watermark,status='complete',error_message=null,updated_at=now()`);
			await tx.execute(sql`update v2_analytics_outbox set status='complete',last_error=null,updated_at=now()
				where request_event_id=any(${ids}::uuid[])`);
			return {
				selected: claimed.length,
				private_grains: privateGrains.length,
				public_daily_grains: dailyGrains.length,
				public_hourly_grains: hourlyGrains.length,
			};
		});
	} finally {
		await client.end({ timeout: 1 });
	}
}
