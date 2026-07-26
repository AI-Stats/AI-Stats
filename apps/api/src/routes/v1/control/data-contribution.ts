import { Hono } from "hono";
import type { Env } from "@/runtime/types";
import { getSupabaseAdmin } from "@/runtime/env";
import { setKeyVersion } from "@/core/kv";
import { isDataContributionAccessEnabled } from "@/core/feature-flags";
import { guardManagementAuth, type GuardErr } from "@/pipeline/before/guards";
import { CAPABILITIES } from "@/lib/authz/capabilities";
import { json, withRuntime } from "@/routes/utils";
import {
	DATA_CONTRIBUTION_POLICY_VERSION,
} from "@/pipeline/classification/data-contribution";
import {
	ensureStarterClassifier,
	OPENROUTER_TASK_CATEGORIES,
} from "@/pipeline/classification/classifier-worker";
import {
	isResponse,
	internalServerError,
	requireCapability,
	requireJsonBody,
	requireOAuthWorkspaceRole,
} from "./route-helpers";

const SAMPLE_RATE_BPS = 10000;
const CLASSIFIER_SAMPLE_RATE_BPS = 1000;
const DISCOUNT_BPS = 100;

async function auditConsentDenial(auth: {
	workspaceId: string;
	authMethod?: "api_key" | "oauth";
	userId?: string | null;
	apiKeyId: string;
}, reason: string): Promise<void> {
	try {
		await getSupabaseAdmin().from("data_contribution_consent_events").insert({
			workspace_id: auth.workspaceId,
			actor_type: auth.authMethod === "oauth" ? "user" : "management_key",
			actor_user_id: auth.userId ?? null,
			actor_key_id: auth.authMethod === "oauth" ? null : auth.apiKeyId,
			action: "change_denied",
			outcome: "denied",
			policy_version: DATA_CONTRIBUTION_POLICY_VERSION,
			sample_rate_bps: SAMPLE_RATE_BPS,
			classifier_sample_rate_bps: CLASSIFIER_SAMPLE_RATE_BPS,
			discount_bps: DISCOUNT_BPS,
			reason,
		});
	} catch (error) {
		console.error("data_contribution_consent_denial_audit_failed", { reason, error: String(error) });
	}
}

async function authenticate(req: Request, write = false, auditConsentDenials = false) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(
		auth.value,
		write ? CAPABILITIES.SETTINGS_WRITE : CAPABILITIES.SETTINGS_READ,
	);
	if (scopeError) {
		if (auditConsentDenials) await auditConsentDenial(auth.value, "insufficient_scope");
		return scopeError;
	}
	const roleError = await requireOAuthWorkspaceRole(
		auth.value,
		auth.value.workspaceId,
		write ? ["owner", "admin"] : ["owner", "admin", "member"],
	);
	if (roleError) {
		if (auditConsentDenials) await auditConsentDenial(auth.value, "insufficient_workspace_role");
		return roleError;
	}
	const userId = auth.value.authMethod === "oauth" ? auth.value.userId?.trim() : null;
	if (!userId) {
		if (auditConsentDenials) await auditConsentDenial(auth.value, "admin_preview_only");
		return json({ error: "not_found" }, 404, { "Cache-Control": "no-store" });
	}
	const roleResult = await getSupabaseAdmin().from("users")
		.select("role").eq("user_id", userId).maybeSingle();
	const isPhaseoAdmin = !roleResult.error && String(roleResult.data?.role ?? "").toLowerCase() === "admin";
	const featureEnabled = isPhaseoAdmin && await isDataContributionAccessEnabled({
		workspaceId: auth.value.workspaceId,
		apiKeyId: auth.value.apiKeyId,
		apiKeyRef: auth.value.apiKeyRef,
		apiKeyKid: auth.value.apiKeyKid,
		userId,
		internal: auth.value.internal,
	});
	if (!featureEnabled) {
		if (auditConsentDenials) await auditConsentDenial(auth.value, "feature_flag_disabled");
		return json({ error: "not_found" }, 404, { "Cache-Control": "no-store" });
	}
	return auth.value;
}

async function invalidateWorkspaceKeys(workspaceId: string): Promise<void> {
	const { data, error } = await getSupabaseAdmin().from("keys")
		.select("id").eq("workspace_id", workspaceId).neq("status", "deleted");
	if (error) throw new Error(error.message || "Failed to invalidate gateway context");
	const version = Date.now();
	await Promise.all((data ?? []).map((row) => setKeyVersion("id", String(row.id), version)));
}

function categoriesFrom(value: unknown): Record<string, string[]> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("categories must be an object of string arrays");
	}
	const entries = Object.entries(value as Record<string, unknown>);
	if (!entries.length || entries.length > 16) throw new Error("categories must contain 1 to 16 groups");
	const normalized = Object.fromEntries(entries.map(([rawGroup, rawLabels]) => {
		const group = rawGroup.trim().slice(0, 64);
		if (!group || !Array.isArray(rawLabels)) throw new Error("each category group must contain labels");
		const labels = Array.from(new Set(rawLabels.map(String).map((label) => label.trim()).filter(Boolean))).slice(0, 32);
		if (!labels.length) throw new Error("each category group must contain at least one label");
		return [group, labels];
	}));
	const totalLabels = Object.values(normalized).reduce((sum, labels) => sum + labels.length, 0);
	if (totalLabels > 128) throw new Error("classifiers support at most 128 labels");
	return normalized;
}

function classifierPatch(body: Record<string, unknown>, creating: boolean): Record<string, unknown> {
	const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
	if (creating || body.name !== undefined) {
		const name = String(body.name ?? "").trim().slice(0, 80);
		if (!name) throw new Error("name is required");
		patch.name = name;
	}
	if (creating || body.instructions !== undefined) {
		const instructions = String(body.instructions ?? "").trim().slice(0, 4000);
		if (!instructions) throw new Error("instructions are required");
		patch.instructions = instructions;
	}
	if (creating || body.categories !== undefined) patch.categories = categoriesFrom(body.categories);
	if (body.description !== undefined) patch.description = String(body.description ?? "").trim().slice(0, 500) || null;
	if (body.enabled !== undefined) patch.enabled = body.enabled === true;
	if (body.model !== undefined) patch.model = String(body.model ?? "").trim().slice(0, 160) || "gpt-5-mini";
	if (body.serviceTier !== undefined || body.service_tier !== undefined) {
		const tier = String(body.serviceTier ?? body.service_tier).trim().toLowerCase();
		if (!["standard", "flex"].includes(tier)) throw new Error("service tier must be standard or flex");
		patch.service_tier = tier;
	}
	if (body.sampleRateBps !== undefined || body.sample_rate_bps !== undefined) {
		const rate = Number(body.sampleRateBps ?? body.sample_rate_bps);
		if (!Number.isInteger(rate) || rate < 0 || rate > 10_000) throw new Error("sample rate must be 0 to 10000 basis points");
		patch.sample_rate_bps = rate;
	}
	return patch;
}

async function getOverview(req: Request) {
	const auth = await authenticate(req);
	if (auth instanceof Response) return auth;
	try {
		const client = getSupabaseAdmin();
		const [settings, classifiers, recent, analytics] = await Promise.all([
			client.from("workspace_settings").select("data_contribution_enabled,data_contribution_policy_version,data_contribution_consented_at,data_contribution_sample_rate_bps,data_contribution_classifier_sample_rate_bps,data_contribution_discount_bps")
				.eq("workspace_id", auth.workspaceId).maybeSingle(),
			client.from("workspace_classifiers").select("id,slug,name,description,kind,instructions,categories,model,service_tier,sample_rate_bps,enabled,created_at,updated_at")
				.eq("workspace_id", auth.workspaceId).order("created_at", { ascending: true }),
			client.rpc("get_data_contribution_totals", {
				p_workspace_id: auth.workspaceId,
				p_since: new Date(Date.now() - 30 * 86_400_000).toISOString(),
			}),
			client.from("request_classification_daily").select("usage_date,classifier_id,primary_category,model_slug,provider_slug,request_count,input_tokens,output_tokens")
				.eq("workspace_id", auth.workspaceId).gte("usage_date", new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10))
				.order("usage_date", { ascending: false }).limit(1000),
		]);
		for (const result of [settings, classifiers, recent, analytics]) if (result.error) throw result.error;
		return json({
			data: {
				enabled: settings.data?.data_contribution_enabled === true,
				policyVersion: settings.data?.data_contribution_policy_version ?? DATA_CONTRIBUTION_POLICY_VERSION,
				consentedAt: settings.data?.data_contribution_consented_at ?? null,
				sampleRateBps: Number(settings.data?.data_contribution_sample_rate_bps ?? SAMPLE_RATE_BPS),
				classifierSampleRateBps: Number(settings.data?.data_contribution_classifier_sample_rate_bps ?? CLASSIFIER_SAMPLE_RATE_BPS),
				discountBps: Number(settings.data?.data_contribution_discount_bps ?? DISCOUNT_BPS),
				last30Days: {
					contributions: Number((recent.data as any)?.contributions ?? 0),
					discountNanos: Number((recent.data as any)?.discount_nanos ?? 0),
				},
				classifiers: classifiers.data ?? [],
				analytics: analytics.data ?? [],
				starterCategories: OPENROUTER_TASK_CATEGORIES,
			},
		}, 200, { "Cache-Control": "no-store" });
	} catch (error) {
		return internalServerError("data-contribution.get", error);
	}
}

async function updateConsent(req: Request) {
	const auth = await authenticate(req, true, true);
	if (auth instanceof Response) return auth;
	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;
	if (typeof body.enabled !== "boolean") return json({ error: "bad_request", message: "enabled must be a boolean" }, 400);
	const enabled = body.enabled;
	try {
		const client = getSupabaseAdmin();
		if (enabled) await ensureStarterClassifier(auth.workspaceId, auth.userId ?? null);
		const { error: settingsError } = await client.rpc("set_data_contribution_consent", {
			p_workspace_id: auth.workspaceId,
			p_enabled: enabled,
			p_actor_type: auth.authMethod === "oauth" ? "user" : "management_key",
			p_actor_user_id: auth.userId ?? null,
			p_actor_key_id: auth.authMethod === "oauth" ? null : auth.apiKeyId,
			p_reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : null,
			p_policy_version: DATA_CONTRIBUTION_POLICY_VERSION,
			p_sample_rate_bps: SAMPLE_RATE_BPS,
			p_classifier_sample_rate_bps: CLASSIFIER_SAMPLE_RATE_BPS,
			p_discount_bps: DISCOUNT_BPS,
		});
		if (settingsError) throw settingsError;
		await invalidateWorkspaceKeys(auth.workspaceId);
		return json({ data: { enabled, policyVersion: DATA_CONTRIBUTION_POLICY_VERSION, sampleRateBps: SAMPLE_RATE_BPS, classifierSampleRateBps: CLASSIFIER_SAMPLE_RATE_BPS, discountBps: DISCOUNT_BPS } }, 200, { "Cache-Control": "no-store" });
	} catch (error) {
		return internalServerError("data-contribution.consent", error);
	}
}

async function createClassifier(req: Request) {
	const auth = await authenticate(req, true);
	if (auth instanceof Response) return auth;
	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;
	try {
		const name = String(body.name ?? "").trim();
		const slugBase = String(body.slug ?? name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
		if (!slugBase || slugBase === "openrouter-task-v1") throw new Error("a unique custom slug is required");
		const { data, error } = await getSupabaseAdmin().from("workspace_classifiers").insert({
			workspace_id: auth.workspaceId,
			slug: slugBase,
			kind: "custom",
			created_by: auth.userId ?? null,
			...classifierPatch(body, true),
		}).select("*").maybeSingle();
		if (error) throw error;
		return json({ data }, 201, { "Cache-Control": "no-store" });
	} catch (error) {
		return json({ error: "classifier_invalid", message: error instanceof Error ? error.message : "Invalid classifier" }, 400, { "Cache-Control": "no-store" });
	}
}

async function updateClassifier(req: Request, id: string) {
	const auth = await authenticate(req, true);
	if (auth instanceof Response) return auth;
	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;
	try {
		const patch = classifierPatch(body, false);
		const { data, error } = await getSupabaseAdmin().from("workspace_classifiers").update(patch)
			.eq("id", id).eq("workspace_id", auth.workspaceId).eq("kind", "custom").select("*").maybeSingle();
		if (error) throw error;
		if (!data) return json({ error: "not_found" }, 404);
		return json({ data }, 200, { "Cache-Control": "no-store" });
	} catch (error) {
		return json({ error: "classifier_invalid", message: error instanceof Error ? error.message : "Invalid classifier" }, 400, { "Cache-Control": "no-store" });
	}
}

async function deleteClassifier(req: Request, id: string) {
	const auth = await authenticate(req, true);
	if (auth instanceof Response) return auth;
	const { data, error } = await getSupabaseAdmin().from("workspace_classifiers").delete()
		.eq("id", id).eq("workspace_id", auth.workspaceId).eq("kind", "custom").select("id").maybeSingle();
	if (error) return internalServerError("data-contribution.classifier.delete", error);
	if (!data) return json({ error: "not_found" }, 404);
	return json({ data: { deleted: true } }, 200, { "Cache-Control": "no-store" });
}

export const dataContributionRoutes = new Hono<Env>();
dataContributionRoutes.get("/", withRuntime(getOverview));
dataContributionRoutes.patch("/consent", withRuntime(updateConsent));
dataContributionRoutes.post("/classifiers", withRuntime(createClassifier));
dataContributionRoutes.patch("/classifiers/:id", withRuntime((req) => updateClassifier(req, new URL(req.url).pathname.split("/").pop() ?? "")));
dataContributionRoutes.delete("/classifiers/:id", withRuntime((req) => deleteClassifier(req, new URL(req.url).pathname.split("/").pop() ?? "")));
