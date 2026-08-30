import type { SupabaseClient } from "@supabase/supabase-js";

const SENSITIVE_KEY = /(authorization|credential|hash|plaintext|scope|secret|token|value)/i;
const MAX_DEPTH = 3;
const MAX_KEYS = 30;
const MAX_STRING_LENGTH = 500;

type WorkspaceAuditEventInput = {
	workspaceId: string;
	actorUserId?: string | null;
	action: string;
	targetType: string;
	targetId: string;
	targetName?: string | null;
	metadata?: Record<string, unknown>;
	requestId?: string | null;
};

function sanitizeValue(value: unknown, depth: number): unknown {
	if (value === null || typeof value === "boolean" || typeof value === "number") return value;
	if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
	if (depth >= MAX_DEPTH) return undefined;
	if (Array.isArray(value)) {
		return value.slice(0, MAX_KEYS).map((item) => sanitizeValue(item, depth + 1)).filter((item) => item !== undefined);
	}
	if (typeof value !== "object") return undefined;
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>)
			.filter(([key]) => !SENSITIVE_KEY.test(key))
			.slice(0, MAX_KEYS)
			.map(([key, item]) => [key, sanitizeValue(item, depth + 1)])
			.filter((entry): entry is [string, unknown] => entry[1] !== undefined),
	);
}

export function sanitizeAuditMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
	return (sanitizeValue(metadata ?? {}, 0) as Record<string, unknown>) ?? {};
}

export async function recordWorkspaceAuditEvent(
	client: SupabaseClient,
	event: WorkspaceAuditEventInput,
): Promise<boolean> {
	const result = await client.from("workspace_audit_events").insert({
		workspace_id: event.workspaceId,
		actor_user_id: event.actorUserId ?? null,
		action: event.action.slice(0, 100),
		target_type: event.targetType.slice(0, 60),
		target_id: event.targetId.slice(0, 200),
		target_name: event.targetName?.slice(0, 200) ?? null,
		metadata: sanitizeAuditMetadata(event.metadata),
		request_id: event.requestId?.slice(0, 200) ?? null,
	});
	if (!result.error) return true;
	console.error("workspace_audit_event_write_failed", {
		action: event.action,
		target_type: event.targetType,
		workspace_id: event.workspaceId,
	});
	return false;
}
