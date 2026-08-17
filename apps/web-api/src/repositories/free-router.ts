import { sql } from "@phaseo/db/query";
import { createDatabase } from "@/data/db";
import type { Env } from "@/env";

export async function listFreeRouterRows(env: Env) {
	const { db, client } = createDatabase(env);
	try {
		const result = await db.execute<Record<string, unknown>>(sql`
			with usage as (
				select fact.routed_model_slug model_slug,count(*)::bigint requests_30d,
					coalesce(sum(pricing.charged_nanos),0)::bigint total_cost_nanos_30d,max(fact.occurred_at) last_routed_at
				from observability.v2_request_facts fact left join observability.v2_request_pricing_lines pricing using(request_event_id)
				where fact.requested_model_input='phaseo/free' and fact.occurred_at>=now()-interval '30 days' group by fact.routed_model_slug
			)
			select model.model_slug,model.name,model.lab_slug,lab.name organisation_name,model.input_modalities model_input_modalities,
				model.output_modalities model_output_modalities,route.provider_slug,route.provider_model_slug,route.input_modalities,
				route.output_modalities,coalesce(usage.requests_30d,0)::bigint requests_30d,
				coalesce(usage.total_cost_nanos_30d,0)::bigint total_cost_nanos_30d,usage.last_routed_at
			from catalog.v2_models model join catalog.v2_model_provider_routes route on route.model_slug=model.model_slug
			left join catalog.v2_labs lab on lab.lab_slug=model.lab_slug left join usage on usage.model_slug=model.model_slug
			where model.variant_kind='free' and model.hidden=false and route.routing_enabled=true
				and route.status in ('active','degraded') and (route.effective_from is null or route.effective_from<=now())
				and (route.effective_to is null or route.effective_to>now())
			order by requests_30d desc,model.model_slug,route.provider_slug
		`);
		return [...result];
	} finally { await client.end({ timeout: 1 }); }
}
