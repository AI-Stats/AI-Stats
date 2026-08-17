import { v2Labs, v2ModelProviderRoutes, v2Models, v2Providers, v2WebPublicUsageDaily, v2WebPublicUsageHourly } from "@phaseo/db/schema";
import { sql } from "@phaseo/db/query";

import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function listProviderIndexRows(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		const result = await db.execute<Record<string, unknown>>(sql`
			with eligible as (
				select provider.provider_slug, provider.name provider_name, provider.country_code, provider.lab_slug,
					provider.metadata,
					provider.routable and provider.routing_enabled and provider.status in ('active','degraded') as is_gateway_provider,
					provider.prompt_training_policy, provider.data_policy_tier, provider.zero_data_retention, provider.data_retention_days,
					route.model_slug, route.routing_enabled, route.status route_status, route.effective_from, route.effective_to,
					route.updated_at, model.variant_kind,
					case when cardinality(route.input_modalities)>0 then route.input_modalities else model.input_modalities end input_modalities,
					case when cardinality(route.output_modalities)>0 then route.output_modalities else model.output_modalities end output_modalities
				from ${v2Providers} provider join ${v2ModelProviderRoutes} route using(provider_slug)
				join ${v2Models} model using(model_slug)
				where provider.provider_slug not in ('inception','inceptron','nextbit') and model.hidden=false
			), coverage as (
				select provider_slug, max(provider_name) provider_name, max(country_code) country_code, max(lab_slug) lab_slug,
					max(metadata::text)::jsonb metadata, bool_or(is_gateway_provider) is_gateway_provider,
					max(prompt_training_policy) prompt_training_policy, max(data_policy_tier) data_policy_tier,
					max(zero_data_retention) zero_data_retention, max(data_retention_days) data_retention_days,
					array_agg(distinct model_slug order by model_slug) total_model_ids,
					array_agg(distinct model_slug order by model_slug) filter(where routing_enabled and route_status in ('active','degraded') and (effective_from is null or effective_from<=now()) and (effective_to is null or effective_to>now())) active_model_ids,
					array_agg(distinct model_slug order by model_slug) filter(where variant_kind='free' or lower(model_slug) like '%:free') free_model_ids,
					max(updated_at) last_updated_at,
					array_agg(distinct model_slug) filter(where 'text'=any(input_modalities)) text_input_model_ids,
					array_agg(distinct model_slug) filter(where 'text'=any(output_modalities)) text_output_model_ids,
					array_agg(distinct model_slug) filter(where 'image'=any(input_modalities)) image_input_model_ids,
					array_agg(distinct model_slug) filter(where 'image'=any(output_modalities)) image_output_model_ids,
					array_agg(distinct model_slug) filter(where 'video'=any(input_modalities)) video_input_model_ids,
					array_agg(distinct model_slug) filter(where 'video'=any(output_modalities)) video_output_model_ids,
					array_agg(distinct model_slug) filter(where 'audio'=any(input_modalities) or 'music'=any(input_modalities)) audio_input_model_ids,
					array_agg(distinct model_slug) filter(where 'audio'=any(output_modalities) or 'music'=any(output_modalities)) audio_output_model_ids,
					array_agg(distinct model_slug) filter(where 'moderation'=any(input_modalities)) moderation_input_model_ids,
					array_agg(distinct model_slug) filter(where 'moderation'=any(output_modalities)) moderation_output_model_ids,
					array_agg(distinct model_slug) filter(where input_modalities && array['embedding','embeddings']) embedding_input_model_ids,
					array_agg(distinct model_slug) filter(where output_modalities && array['embedding','embeddings']) embedding_output_model_ids
				from eligible group by provider_slug
			), hourly as (select provider, sum(requests)::bigint requests_24h, sum(total_tokens)::numeric tokens_24h from ${v2WebPublicUsageHourly} where bucket_15m>=now()-interval '24 hours' group by provider),
			daily as (select provider, sum(total_tokens)::numeric tokens_30d from ${v2WebPublicUsageDaily} where day_bucket>=current_date-29 group by provider)
			select coverage.provider_slug, coverage.provider_name, nullif(coverage.metadata->>'colour','') colour, coverage.country_code,
				coalesce(nullif(coverage.metadata->>'provider_family_id',''), coverage.lab_slug) provider_family_id,
				nullif(coverage.metadata->>'offer_label','') offer_label, nullif(coverage.metadata->>'offer_scope','') offer_scope,
				coverage.is_gateway_provider, coverage.prompt_training_policy, coverage.data_policy_tier, coverage.zero_data_retention,
				coverage.data_retention_days, nullif(coverage.metadata->>'privacy_policy_url','') privacy_policy_url,
				nullif(coverage.metadata->>'terms_of_service_url','') terms_of_service_url, coverage.total_model_ids,
				coalesce(coverage.active_model_ids,array[]::text[]) active_model_ids, coalesce(coverage.free_model_ids,array[]::text[]) free_model_ids,
				coalesce(hourly.requests_24h,0) requests_24h, coalesce(hourly.tokens_24h,0) tokens_24h, coalesce(daily.tokens_30d,0) tokens_30d,
				coverage.last_updated_at,
				coalesce(text_input_model_ids,array[]::text[]) text_input_model_ids, coalesce(text_output_model_ids,array[]::text[]) text_output_model_ids,
				coalesce(image_input_model_ids,array[]::text[]) image_input_model_ids, coalesce(image_output_model_ids,array[]::text[]) image_output_model_ids,
				coalesce(video_input_model_ids,array[]::text[]) video_input_model_ids, coalesce(video_output_model_ids,array[]::text[]) video_output_model_ids,
				coalesce(audio_input_model_ids,array[]::text[]) audio_input_model_ids, coalesce(audio_output_model_ids,array[]::text[]) audio_output_model_ids,
				coalesce(moderation_input_model_ids,array[]::text[]) moderation_input_model_ids, coalesce(moderation_output_model_ids,array[]::text[]) moderation_output_model_ids,
				coalesce(embedding_input_model_ids,array[]::text[]) embedding_input_model_ids, coalesce(embedding_output_model_ids,array[]::text[]) embedding_output_model_ids
			from coverage left join hourly on hourly.provider=coverage.provider_slug left join daily on daily.provider=coverage.provider_slug
			order by coverage.provider_name, coverage.provider_slug
		`);
		return [...result];
	} finally { await client.end({ timeout: 1 }); }
}
