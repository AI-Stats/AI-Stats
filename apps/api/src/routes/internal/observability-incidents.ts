import { Hono } from "hono";
import { z } from "zod";
import type { GatewayBindings } from "@/runtime/env.types";
import type { Env } from "@/runtime/types";

const IncidentSchema = z.object({
	source: z.enum(["axiom", "posthog"]),
	action: z.enum(["open", "resolved", "repeated"]).default("open"),
	fingerprint: z.string().trim().min(1).max(500),
	title: z.string().trim().min(1).max(300),
	description: z.string().trim().max(10_000).optional(),
	severity: z.enum(["urgent", "high", "medium", "low"]).default("medium"),
	environment: z.string().trim().max(100).optional(),
	source_url: z.string().url().max(2_000),
	replay_url: z.string().url().max(2_000).optional(),
	release: z.string().trim().max(300).optional(),
	route: z.string().trim().max(1_000).optional(),
	request_ids: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
	occurrences: z.number().int().nonnegative().optional(),
	affected_users: z.number().int().nonnegative().optional(),
});

type Incident = z.infer<typeof IncidentSchema>;
type IncidentMapping = {
	issueId: string;
	identifier: string;
	url: string;
	lastNotifiedAt: string;
};

const LINEAR_API_URL = "https://api.linear.app/graphql";
const MAPPING_TTL_SECONDS = 60 * 60 * 24 * 365;
const REPEAT_COMMENT_INTERVAL_MS = 15 * 60 * 1000;

function timingSafeEqual(a: string, b: string): boolean {
	const left = new TextEncoder().encode(a);
	const right = new TextEncoder().encode(b);
	if (left.length !== right.length) return false;
	let mismatch = 0;
	for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index];
	return mismatch === 0;
}

function isAuthorized(authorization: string | undefined, secret: string | undefined): boolean {
	if (!secret || secret.length < 32) return false;
	const provided = authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
	return provided.length > 0 && timingSafeEqual(provided, secret);
}

async function mappingKey(incident: Incident): Promise<string> {
	const bytes = new TextEncoder().encode(`${incident.source}:${incident.fingerprint}`);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
	return `observability-linear:${hash}`;
}

function priorityFor(severity: Incident["severity"]): number {
	return { urgent: 1, high: 2, medium: 3, low: 4 }[severity];
}

function incidentDescription(incident: Incident): string {
	const context = [
		`- Source: ${incident.source === "posthog" ? "PostHog" : "Axiom"}`,
		`- Environment: ${incident.environment ?? "unknown"}`,
		incident.route ? `- Route: \`${incident.route}\`` : null,
		incident.release ? `- Release: \`${incident.release}\`` : null,
		incident.occurrences !== undefined ? `- Occurrences: ${incident.occurrences}` : null,
		incident.affected_users !== undefined ? `- Affected users: ${incident.affected_users}` : null,
		incident.request_ids.length ? `- Request IDs: ${incident.request_ids.map((id) => `\`${id}\``).join(", ")}` : null,
		`- [Open in ${incident.source === "posthog" ? "PostHog" : "Axiom"}](${incident.source_url})`,
		incident.replay_url ? `- [Open session replay](${incident.replay_url})` : null,
	].filter(Boolean).join("\n");
	return `${incident.description ? `${incident.description}\n\n` : ""}## Incident context\n\n${context}\n\n<!-- observability:${incident.source}:${incident.fingerprint} -->`;
}

async function linearRequest<T>(bindings: GatewayBindings, query: string, variables: Record<string, unknown>): Promise<T> {
	if (!bindings.LINEAR_API_KEY) throw new Error("linear_api_key_not_configured");
	const response = await fetch(LINEAR_API_URL, {
		method: "POST",
		headers: { authorization: bindings.LINEAR_API_KEY, "content-type": "application/json" },
		body: JSON.stringify({ query, variables }),
	});
	const payload = await response.json() as { data?: T; errors?: Array<{ message?: string }> };
	if (!response.ok || payload.errors?.length || !payload.data) {
		throw new Error(`linear_request_failed:${payload.errors?.[0]?.message ?? response.status}`);
	}
	return payload.data;
}

function requiredLinearConfig(bindings: GatewayBindings) {
	const config = {
		teamId: bindings.LINEAR_TEAM_ID,
		projectId: bindings.LINEAR_PROJECT_ID,
		stateId: bindings.LINEAR_TRIAGE_STATUS_ID,
		assigneeId: bindings.LINEAR_ASSIGNEE_ID,
		labelId: bindings.LINEAR_OBSERVABILITY_LABEL_ID,
	};
	if (Object.values(config).some((value) => !value)) throw new Error("linear_destination_not_configured");
	return config as Record<keyof typeof config, string>;
}

async function createIssue(bindings: GatewayBindings, incident: Incident): Promise<IncidentMapping> {
	const config = requiredLinearConfig(bindings);
	const data = await linearRequest<{
		issueCreate: { success: boolean; issue: { id: string; identifier: string; url: string } };
	}>(bindings, `mutation CreateObservabilityIssue($input: IssueCreateInput!) {
		issueCreate(input: $input) { success issue { id identifier url } }
	}`, {
		input: {
			title: incident.title,
			description: incidentDescription(incident),
			teamId: config.teamId,
			projectId: config.projectId,
			stateId: config.stateId,
			assigneeId: config.assigneeId,
			labelIds: [config.labelId, incident.source === "posthog" ? "045f0664-0f61-4df8-8496-a048591f010a" : "51a317cb-ec4f-422a-8e0f-6662cc30b7e0"],
			priority: priorityFor(incident.severity),
		},
	});
	if (!data.issueCreate.success) throw new Error("linear_issue_create_failed");
	return {
		issueId: data.issueCreate.issue.id,
		identifier: data.issueCreate.issue.identifier,
		url: data.issueCreate.issue.url,
		lastNotifiedAt: new Date().toISOString(),
	};
}

async function addComment(bindings: GatewayBindings, issueId: string, incident: Incident): Promise<void> {
	const verb = incident.action === "resolved" ? "resolved" : "recurred";
	const details = [
		`The ${incident.source === "posthog" ? "PostHog" : "Axiom"} signal ${verb}.`,
		incident.occurrences !== undefined ? `Occurrences: ${incident.occurrences}.` : null,
		incident.affected_users !== undefined ? `Affected users: ${incident.affected_users}.` : null,
		`[Open source incident](${incident.source_url})`,
	].filter(Boolean).join("\n\n");
	await linearRequest(bindings, `mutation CommentOnObservabilityIssue($input: CommentCreateInput!) {
		commentCreate(input: $input) { success }
	}`, { input: { issueId, body: details } });
}

async function handleIncident(bindings: GatewayBindings, incident: Incident): Promise<IncidentMapping & { created: boolean; commented: boolean }> {
	const key = await mappingKey(incident);
	const existing = await bindings.GATEWAY_CACHE.get<IncidentMapping>(key, "json");
	if (!existing) {
		if (incident.action === "resolved") throw new Error("incident_mapping_not_found");
		const created = await createIssue(bindings, incident);
		await bindings.GATEWAY_CACHE.put(key, JSON.stringify(created), { expirationTtl: MAPPING_TTL_SECONDS });
		return { ...created, created: true, commented: false };
	}

	const lastNotified = Date.parse(existing.lastNotifiedAt);
	const shouldComment = incident.action === "resolved" || !Number.isFinite(lastNotified) || Date.now() - lastNotified >= REPEAT_COMMENT_INTERVAL_MS;
	if (!shouldComment) return { ...existing, created: false, commented: false };

	await addComment(bindings, existing.issueId, incident);
	const updated = { ...existing, lastNotifiedAt: new Date().toISOString() };
	await bindings.GATEWAY_CACHE.put(key, JSON.stringify(updated), { expirationTtl: MAPPING_TTL_SECONDS });
	return { ...updated, created: false, commented: true };
}

export const internalObservabilityIncidentRoutes = new Hono<Env>();

internalObservabilityIncidentRoutes.post("/", async (c) => {
	if (!isAuthorized(c.req.header("authorization"), c.env.OBSERVABILITY_WEBHOOK_SECRET)) {
		return c.json({ error: "unauthorized" }, 401);
	}

	const body = await c.req.json().catch(() => null);
	const parsed = IncidentSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: "invalid_incident", issues: parsed.error.issues }, 400);

	try {
		const result = await handleIncident(c.env, parsed.data);
		return c.json(result, result.created ? 201 : 200);
	} catch (error) {
		console.error("observability_linear_sync_failed", { source: parsed.data.source, fingerprint: parsed.data.fingerprint, error });
		return c.json({ error: "incident_sync_failed" }, 502);
	}
});

export const observabilityIncidentInternals = { IncidentSchema, handleIncident, incidentDescription, isAuthorized, mappingKey };
