import { Hono } from "hono";
import type { Env } from "@/runtime/types";
import { auditConsentEvent, createClassifier as insertClassifier, deleteClassifier as removeClassifier, isPhaseoAdmin, listWorkspaceKeyIds, loadDataContributionOverview, setDataContributionConsent, updateClassifier as persistClassifier, type ClassifierPatch } from "@/repositories/data-contribution";
import { findWorkspaceOwnerUserId, findWorkspaceRole } from "@/repositories/management";
import { setKeyVersion } from "@/core/kv";
import { isDataContributionAccessEnabled } from "@/core/feature-flags";
import { getOAuthRequestActor } from "@/lib/oauth/service";
import type { AuthSuccess } from "@/pipeline/before/auth";
import { guardManagementAuth, type GuardErr } from "@/pipeline/before/guards";
import { CAPABILITIES } from "@/lib/authz/capabilities";
import { json, withRuntime } from "@/routes/utils";
import {
	DATA_CONTRIBUTION_POLICY_VERSION,
} from "@/pipeline/classification/data-contribution";
import {
	ALLOWED_CLASSIFIER_MODELS,
	ensureStarterClassifier,
	STARTER_TASK_CATEGORIES,
	STARTER_CLASSIFIER_SLUG,
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
		await auditConsentEvent({
			workspaceId: auth.workspaceId,
			actorType: auth.authMethod === "oauth" ? "user" : "management_key",
			actorUserId: auth.userId ?? null,
			actorKeyId: auth.authMethod === "oauth" ? null : auth.apiKeyId,
			action: "change_denied",
			outcome: "denied",
			policyVersion: DATA_CONTRIBUTION_POLICY_VERSION,
			sampleRateBps: SAMPLE_RATE_BPS,
			classifierSampleRateBps: CLASSIFIER_SAMPLE_RATE_BPS,
			discountBps: DISCOUNT_BPS,
			reason,
		});
	} catch (error) {
		console.error("data_contribution_consent_denial_audit_failed", { reason, error: String(error) });
	}
}

async function requireAdminPreview(
	auth: AuthSuccess,
	auditConsentDenials: boolean,
): Promise<AuthSuccess | Response> {
	const userId = auth.userId?.trim();
	if (!userId) {
		if (auditConsentDenials) await auditConsentDenial(auth, "admin_preview_only");
		return json({ error: "not_found" }, 404, { "Cache-Control": "no-store" });
	}
	if (!await isPhaseoAdmin(userId)) {
		if (auditConsentDenials) await auditConsentDenial(auth, "not_phaseo_admin");
		return json({ error: "not_found" }, 404, { "Cache-Control": "no-store" });
	}
	const featureEnabled = await isDataContributionAccessEnabled({
		workspaceId: auth.workspaceId,
		apiKeyId: auth.apiKeyId,
		apiKeyRef: auth.apiKeyRef,
		apiKeyKid: auth.apiKeyKid,
		userId,
		internal: auth.internal,
	});
	if (!featureEnabled) {
		if (auditConsentDenials) await auditConsentDenial(auth, "feature_flag_disabled");
		return json({ error: "not_found" }, 404, { "Cache-Control": "no-store" });
	}
	return auth;
}

export async function authenticateDashboardDataContribution(
	req: Request,
	auditConsentDenials: boolean,
): Promise<AuthSuccess | Response | null> {
	const workspaceId = req.headers.get("x-phaseo-workspace-id")?.trim();
	if (!workspaceId) return null;
	const actor = await getOAuthRequestActor(req);
	if (!actor) return json({ error: "unauthorized" }, 401, { "Cache-Control": "no-store" });
	const [membershipRole, ownerUserId] = await Promise.all([findWorkspaceRole(actor.userId, workspaceId), findWorkspaceOwnerUserId(workspaceId)]);
	if (!ownerUserId) {
		return json({ error: "forbidden" }, 403, { "Cache-Control": "no-store" });
	}
	const workspaceRole = ownerUserId === actor.userId
		? "owner"
		: String(membershipRole ?? "").toLowerCase();
	const auth: AuthSuccess = {
		ok: true,
		workspaceId,
		apiKeyId: `dashboard:${actor.userId}`,
		apiKeyRef: "dashboard",
		apiKeyKid: "dashboard",
		userId: actor.userId,
		internal: false,
		authMethod: "oauth",
		oauthScopes: [CAPABILITIES.SETTINGS_READ, CAPABILITIES.SETTINGS_WRITE],
		scopes: [CAPABILITIES.SETTINGS_READ, CAPABILITIES.SETTINGS_WRITE],
	};
	if (!["owner", "admin"].includes(workspaceRole)) {
		if (auditConsentDenials) await auditConsentDenial(auth, "insufficient_workspace_role");
		return json({ error: "forbidden" }, 403, { "Cache-Control": "no-store" });
	}
	return requireAdminPreview(auth, auditConsentDenials);
}

async function authenticate(req: Request, write = false, auditConsentDenials = false) {
	const dashboardAuth = await authenticateDashboardDataContribution(req, auditConsentDenials);
	if (dashboardAuth) return dashboardAuth;
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
	return requireAdminPreview({ ok: true, ...auth.value }, auditConsentDenials);
}

async function invalidateWorkspaceKeys(workspaceId: string): Promise<void> {
	const keyIds = await listWorkspaceKeyIds(workspaceId);
	const version = Date.now();
	await Promise.all(keyIds.map((id) => setKeyVersion("id", id, version)));
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
	if (body.model !== undefined) {
		const model = String(body.model ?? "").trim().replace(/^openai\//, "").slice(0, 160) || "gpt-5-mini";
		if (!ALLOWED_CLASSIFIER_MODELS.has(model)) throw new Error("classifier model is not approved");
		patch.model = model;
	}
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

function toClassifierPatch(patch: Record<string, unknown>): ClassifierPatch {
	return {
		name: typeof patch.name === "string" ? patch.name : undefined,
		description: patch.description === null || typeof patch.description === "string" ? patch.description as string | null : undefined,
		instructions: typeof patch.instructions === "string" ? patch.instructions : undefined,
		categories: patch.categories as Record<string, string[]> | undefined,
		model: typeof patch.model === "string" ? patch.model : undefined,
		serviceTier: typeof patch.service_tier === "string" ? patch.service_tier : undefined,
		sampleRateBps: typeof patch.sample_rate_bps === "number" ? patch.sample_rate_bps : undefined,
		enabled: typeof patch.enabled === "boolean" ? patch.enabled : undefined,
	};
}

function serializeDatabaseRow(row: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`), value]));
}

async function getOverview(req: Request) {
	const auth = await authenticate(req);
	if (auth instanceof Response) return auth;
	try {
		const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
		const { settings, classifiers, totals, analytics } = await loadDataContributionOverview(auth.workspaceId, since, since.slice(0, 10));
		return json({
			data: {
				enabled: settings?.dataContributionEnabled === true,
				policyVersion: settings?.dataContributionPolicyVersion ?? DATA_CONTRIBUTION_POLICY_VERSION,
				consentedAt: settings?.dataContributionConsentedAt ?? null,
				sampleRateBps: Number(settings?.dataContributionSampleRateBps ?? SAMPLE_RATE_BPS),
				classifierSampleRateBps: Number(settings?.dataContributionClassifierSampleRateBps ?? CLASSIFIER_SAMPLE_RATE_BPS),
				discountBps: Number(settings?.dataContributionDiscountBps ?? DISCOUNT_BPS),
				last30Days: {
					contributions: Number(totals.contributions ?? 0),
					discountNanos: Number(totals.discountNanos ?? 0),
				},
				classifiers: classifiers.map((row) => serializeDatabaseRow(row)),
				analytics: analytics.map((row) => serializeDatabaseRow(row)),
				starterCategories: STARTER_TASK_CATEGORIES,
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
		if (enabled) await ensureStarterClassifier(auth.workspaceId, auth.userId ?? null);
		await setDataContributionConsent({
			workspaceId: auth.workspaceId,
			enabled,
			actorType: auth.authMethod === "oauth" ? "user" : "management_key",
			actorUserId: auth.userId ?? null,
			actorKeyId: auth.authMethod === "oauth" ? null : auth.apiKeyId,
			reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : null,
			policyVersion: DATA_CONTRIBUTION_POLICY_VERSION,
			sampleRateBps: SAMPLE_RATE_BPS,
			classifierSampleRateBps: CLASSIFIER_SAMPLE_RATE_BPS,
			discountBps: DISCOUNT_BPS,
		});
		try {
			await invalidateWorkspaceKeys(auth.workspaceId);
		} catch (error) {
			console.error("data_contribution_consent_cache_invalidation_failed", {
				workspaceId: auth.workspaceId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
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
		if (!slugBase || slugBase === STARTER_CLASSIFIER_SLUG) throw new Error("a unique custom slug is required");
		const data = await insertClassifier(auth.workspaceId, slugBase, auth.userId ?? null, toClassifierPatch(classifierPatch(body, true)));
		return json({ data: serializeDatabaseRow(data) }, 201, { "Cache-Control": "no-store" });
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
		const patch = toClassifierPatch(classifierPatch(body, false));
		const data = await persistClassifier(auth.workspaceId, id, patch);
		if (!data) return json({ error: "not_found" }, 404);
		return json({ data: serializeDatabaseRow(data) }, 200, { "Cache-Control": "no-store" });
	} catch (error) {
		return json({ error: "classifier_invalid", message: error instanceof Error ? error.message : "Invalid classifier" }, 400, { "Cache-Control": "no-store" });
	}
}

async function deleteClassifier(req: Request, id: string) {
	const auth = await authenticate(req, true);
	if (auth instanceof Response) return auth;
	if (!await removeClassifier(auth.workspaceId, id)) return json({ error: "not_found" }, 404);
	return json({ data: { deleted: true } }, 200, { "Cache-Control": "no-store" });
}

export const dataContributionRoutes = new Hono<Env>();
dataContributionRoutes.get("/", withRuntime(getOverview));
dataContributionRoutes.patch("/consent", withRuntime(updateConsent));
dataContributionRoutes.post("/classifiers", withRuntime(createClassifier));
function classifierId(req: Request): string {
	return new URL(req.url).pathname.replace(/\/+$/, "").split("/").pop() ?? "";
}

dataContributionRoutes.patch("/classifiers/:id", withRuntime((req) => updateClassifier(req, classifierId(req))));
dataContributionRoutes.delete("/classifiers/:id", withRuntime((req) => deleteClassifier(req, classifierId(req))));
