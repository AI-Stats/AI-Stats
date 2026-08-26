import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScimAuthContext } from "./auth";

export type ScimAuditInput = {
	action: string; outcome: "success" | "failure" | "denied"; status: number;
	resourceType?: string; resourceId?: string; scimType?: string; detail?: string; correlationId?: string;
};

export async function writeScimAudit(client: SupabaseClient, request: Request, auth: ScimAuthContext, input: ScimAuditInput) {
	const requestId = request.headers.get("cf-ray") ?? request.headers.get("x-request-id") ?? crypto.randomUUID();
	const userAgent = request.headers.get("user-agent")?.slice(0, 512) || null;
	const result = await client.from("scim_audit_events").insert({
		workspace_id: auth.workspaceId, endpoint_id: auth.endpointId, token_id: auth.tokenId,
		request_id: requestId, correlation_id: input.correlationId ?? null, action: input.action,
		resource_type: input.resourceType ?? null, resource_id: input.resourceId ?? null,
		outcome: input.outcome, http_status: input.status, scim_type: input.scimType ?? null,
		detail: input.detail?.slice(0, 1_000) ?? null, user_agent: userAgent,
	});
	if (result.error) console.error("[web-api/scim] audit insert failed", { requestId, action: input.action, code: result.error.code });
}
