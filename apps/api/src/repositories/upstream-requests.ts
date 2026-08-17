import { sql } from "@phaseo/db/query";

import { createDatabase } from "@/runtime/db";
import { getBindings } from "@/runtime/env";

export async function insertGatewayUpstreamRequests(rows: Array<Record<string, unknown>>): Promise<void> {
	if (rows.length === 0) return;
	const { db, client } = createDatabase(getBindings());
	try {
		await db.execute(sql`
			insert into gateway_upstream_requests (
				created_at,gateway_request_id,gateway_request_created_at,request_id,workspace_id,app_id,key_id,
				sequence,round_number,attempt_number,internal_attempt_number,stage,endpoint,model_id,provider,
				api_model_id,provider_model_slug,upstream_route,upstream_url,status_code,status_text,success,outcome,
				retryable,fallback_attempted,was_probe,key_source,native_response_id,provider_finish_reason,finish_reason,
				duration_ms,latency_ms,generation_ms,total_ms,request_build_ms,upstream_headers_ms,retry_delay_ms,
				usage,cost_nanos,currency,error_code,error_type,error_message,error_description,error_param,
				request_payload,response_payload,metadata
			)
			select created_at,gateway_request_id,gateway_request_created_at,request_id,workspace_id,app_id,key_id,
				sequence,round_number,attempt_number,internal_attempt_number,stage,endpoint,model_id,provider,
				api_model_id,provider_model_slug,upstream_route,upstream_url,status_code,status_text,success,outcome,
				retryable,fallback_attempted,was_probe,key_source,native_response_id,provider_finish_reason,finish_reason,
				duration_ms,latency_ms,generation_ms,total_ms,request_build_ms,upstream_headers_ms,retry_delay_ms,
				usage,cost_nanos,currency,error_code,error_type,error_message,error_description,error_param,
				request_payload,response_payload,metadata
			from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as row(
				created_at timestamptz,gateway_request_id uuid,gateway_request_created_at timestamptz,request_id text,
				workspace_id uuid,app_id uuid,key_id uuid,sequence integer,round_number integer,attempt_number integer,
				internal_attempt_number integer,stage text,endpoint text,model_id text,provider text,api_model_id text,
				provider_model_slug text,upstream_route text,upstream_url text,status_code integer,status_text text,
				success boolean,outcome text,retryable boolean,fallback_attempted boolean,was_probe boolean,key_source text,
				native_response_id text,provider_finish_reason text,finish_reason text,duration_ms integer,latency_ms integer,
				generation_ms integer,total_ms integer,request_build_ms integer,upstream_headers_ms integer,retry_delay_ms integer,
				usage jsonb,cost_nanos bigint,currency text,error_code text,error_type text,error_message text,
				error_description text,error_param text,request_payload jsonb,response_payload jsonb,metadata jsonb
			)
		`);
	} finally {
		await client.end({ timeout: 1 });
	}
}
