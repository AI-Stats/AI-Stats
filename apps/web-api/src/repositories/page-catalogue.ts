import { v2Models, v2PublicUsageDaily, v2PublicUsageDailyMeters } from "@phaseo/db/schema";
import { sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

type CatalogueQuery = { region?: string | null; serviceTier?: string | null };

export async function listPublicModelsPageRows(env: Env, query: CatalogueQuery = {}) {
	const { db, client } = createDatabase(env);
	try {
		const region = query.region?.trim().toLowerCase() || null;
		const serviceTier = query.serviceTier?.trim().toLowerCase() || null;
		const cacheBucketMs = 15 * 60 * 1_000;
		const asOf = new Date(Math.floor(Date.now() / cacheBucketMs) * cacheBucketMs).toISOString();
		const rows = await db.execute<{ row_data: Record<string, unknown> }>(sql`
			/*application='phaseo-web-api',service='web-api',route='/api/_web/models',feature='catalogue'*/
			select row_data
			from catalog.get_public_models_page_rows(
				${region}::text,
				${serviceTier}::text,
				${asOf}::timestamptz
			)
		`);
		return [...rows].map((row) => row.row_data);
	} finally { await client.end({ timeout: 1 }); }
}

export async function listPublicModelWeeklyMetrics(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		const end = new Date();
		end.setUTCHours(0, 0, 0, 0);
		const start = new Date(end);
		start.setUTCDate(start.getUTCDate() - 6);
		const rows = await db.execute<Record<string, unknown>>(sql`
			/*application='phaseo-web-api',service='web-api',route='/api/_web/models',feature='catalogue-weekly-metrics'*/
			with recent as materialized (
				select * from ${v2PublicUsageDaily}
				where usage_date between ${start.toISOString().slice(0, 10)}::date
					and ${end.toISOString().slice(0, 10)}::date
			), rollups as (
				select model_slug, sum(requests)::numeric requests,
					sum(latency_sum_ms)::numeric latency_sum_ms, sum(latency_count)::numeric latency_count,
					sum(throughput_sum)::numeric throughput_sum, sum(throughput_count)::numeric throughput_count
				from recent group by model_slug
			), meters as (
				select recent.model_slug,
					sum(meter.quantity) filter(where meter.meter_key in ('input_tokens','output_tokens') and meter.unit in ('token','tokens')) tokens,
					sum(meter.quantity) filter(where meter.meter_key in ('output_images','output_image') and meter.unit in ('image','images')) images,
					sum(meter.quantity) filter(where meter.meter_key in ('output_video_seconds','video_seconds') and meter.unit in ('second','seconds')) video_seconds,
					sum(meter.quantity) filter(where meter.meter_key in ('audio_seconds','input_audio_seconds','output_audio_seconds') and meter.unit in ('second','seconds')) audio_seconds,
					sum(meter.quantity) filter(where meter.meter_key in ('input_characters','output_characters','total_characters') and meter.unit in ('character','characters')) characters
				from ${v2PublicUsageDailyMeters} meter join recent on recent.rollup_id=meter.rollup_id group by recent.model_slug
			), classified as (
				select rollup.*, coalesce(meter.tokens,0) tokens, coalesce(meter.images,0) images,
					coalesce(meter.video_seconds,0) video_seconds, coalesce(meter.audio_seconds,0) audio_seconds,
					coalesce(meter.characters,0) characters, lower(coalesce(model.metadata->>'model_type','')) model_type,
					array_to_string(model.input_modalities,',') input_modalities, array_to_string(model.output_modalities,',') output_modalities
				from rollups rollup join ${v2Models} model on model.model_slug=rollup.model_slug left join meters meter on meter.model_slug=rollup.model_slug
			)
			select model_slug, tokens popularity_tokens_week,
				case when (model_type='video' or output_modalities~'video') and video_seconds>0 then 'video_seconds'
					when (model_type='image' or output_modalities~'image') and images>0 then 'images'
					when (input_modalities~'audio' or output_modalities~'audio') and audio_seconds>0 then 'audio_seconds'
					when model_type in ('embedding','rerank','moderation') then 'requests'
					when tokens>0 then 'tokens'
					when characters>0 and (model_type='audio' or output_modalities~'audio') then 'characters'
					else 'requests' end weekly_usage_metric,
				case when (model_type='video' or output_modalities~'video') and video_seconds>0 then video_seconds
					when (model_type='image' or output_modalities~'image') and images>0 then images
					when (input_modalities~'audio' or output_modalities~'audio') and audio_seconds>0 then audio_seconds
					when model_type in ('embedding','rerank','moderation') then requests
					when tokens>0 then tokens
					when characters>0 and (model_type='audio' or output_modalities~'audio') then characters
					else requests end weekly_usage_quantity,
				case when (model_type='video' or output_modalities~'video') and video_seconds>0 then 'seconds'
					when (model_type='image' or output_modalities~'image') and images>0 then 'images'
					when (input_modalities~'audio' or output_modalities~'audio') and audio_seconds>0 then 'seconds'
					when tokens>0 then 'tokens'
					when characters>0 and (model_type='audio' or output_modalities~'audio') then 'characters'
					else 'requests' end weekly_usage_unit,
				round(throughput_sum/nullif(throughput_count,0),2) throughput_week,
				round(latency_sum_ms/nullif(latency_count,0),2) latency_week
			from classified order by weekly_usage_quantity desc, model_slug
		`);
		return [...rows];
	} finally { await client.end({ timeout: 1 }); }
}
