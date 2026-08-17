import { Hono } from "hono";
import type { Env } from "@/runtime/types";
import {
	addGuardrailKeys, addGuardrailMembers, createGuardrail, deleteGuardrail, findGuardrail,
	listGuardrailKeyIds, listGuardrails, removeGuardrailKeys, removeGuardrailMembers,
	replaceGuardrailKeys, updateGuardrail, validWorkspaceKeyIds, validWorkspaceMemberIds,
	type GuardrailPatch,
} from "@/repositories/guardrails";
import { guardManagementAuth, type GuardErr } from "@/pipeline/before/guards";
import { bumpWorkspacePolicyVersion } from "@/pipeline/before/workspacePolicy";
import { CAPABILITIES } from "@/lib/authz/capabilities";
import { json, withRuntime } from "@/routes/utils";
import {
	listGuardrailKeyAssignments,
	listGuardrailMemberAssignments,
} from "@/repositories/workspace-members";
import {
	internalServerError,
	isResponse,
	parseOffset,
	parsePathId,
	parsePositiveInt,
	requireJsonBody,
	requireCapability,
	requireOAuthWorkspaceRole,
} from "./route-helpers";

type GuardrailRow = Record<string, unknown> & {
	id: string;
	workspace_id: string;
	name?: string | null;
};

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 250;

type KeyAssignmentRow = {
	key_id: string;
	name?: string | null;
	prefix?: string | null;
	status?: string | null;
	created_at?: string | null;
};

type MemberAssignmentRow = {
	user_id: string;
	role?: string | null;
	display_name?: string | null;
	joined_at?: string | null;
};

const FIELD_MAP: Record<string, string> = {
	privacyEnablePaidMayTrain: "privacy_enable_paid_may_train",
	privacyEnableFreeMayTrain: "privacy_enable_free_may_train",
	privacyEnableFreeMayPublishPrompts: "privacy_enable_free_may_publish_prompts",
	privacyEnableInputOutputLogging: "privacy_enable_input_output_logging",
	privacyZdrOnly: "privacy_zdr_only",
	providerRestrictionMode: "provider_restriction_mode",
	providerRestrictionProviderIds: "provider_restriction_provider_ids",
	providerRestrictionEnforceAllowed: "provider_restriction_enforce_allowed",
	modelRestrictionMode: "model_restriction_mode",
	allowedApiModelIds: "allowed_api_model_ids",
	promptInjectionEnabled: "prompt_injection_enabled",
	promptInjectionAction: "prompt_injection_action",
	sensitiveInfoEnabled: "sensitive_info_enabled",
	sensitiveInfoDefaultAction: "sensitive_info_default_action",
	sensitiveInfoRules: "sensitive_info_rules",
};

const WRITABLE_FIELDS = new Set([
	"name",
	"description",
	"enabled",
	"privacy_enable_paid_may_train",
	"privacy_enable_free_may_train",
	"privacy_enable_free_may_publish_prompts",
	"privacy_enable_input_output_logging",
	"privacy_zdr_only",
	"provider_restriction_mode",
	"provider_restriction_provider_ids",
	"provider_restriction_enforce_allowed",
	"model_restriction_mode",
	"allowed_api_model_ids",
	"prompt_injection_enabled",
	"prompt_injection_action",
	"sensitive_info_enabled",
	"sensitive_info_default_action",
	"sensitive_info_rules",
	"daily_limit_requests",
	"weekly_limit_requests",
	"monthly_limit_requests",
	"daily_limit_cost_nanos",
	"weekly_limit_cost_nanos",
	"monthly_limit_cost_nanos",
]);

function normalizeGuardrailPatch(body: Record<string, unknown>): Record<string, unknown> {
	const patch: Record<string, unknown> = {};
	for (const [rawKey, value] of Object.entries(body)) {
		if (rawKey === "budgets" && value && typeof value === "object" && !Array.isArray(value)) {
			const budgets = value as Record<string, unknown>;
			if (budgets.dailyRequests !== undefined) patch.daily_limit_requests = budgets.dailyRequests;
			if (budgets.weeklyRequests !== undefined) patch.weekly_limit_requests = budgets.weeklyRequests;
			if (budgets.monthlyRequests !== undefined) patch.monthly_limit_requests = budgets.monthlyRequests;
			if (budgets.dailyCostNanos !== undefined) patch.daily_limit_cost_nanos = budgets.dailyCostNanos;
			if (budgets.weeklyCostNanos !== undefined) patch.weekly_limit_cost_nanos = budgets.weeklyCostNanos;
			if (budgets.monthlyCostNanos !== undefined) patch.monthly_limit_cost_nanos = budgets.monthlyCostNanos;
			continue;
		}
		const key = FIELD_MAP[rawKey] ?? rawKey;
		if (WRITABLE_FIELDS.has(key)) patch[key] = value;
	}
	if (typeof patch.name === "string") patch.name = patch.name.trim();
	if (!patch.name && body.name !== undefined) delete patch.name;
	return patch;
}

function toGuardrailPatch(patch: Record<string, unknown>): GuardrailPatch {
	const mapped: Record<string, unknown> = {};
	const names: Record<string, string> = {
		privacy_enable_paid_may_train: "privacyEnablePaidMayTrain", privacy_enable_free_may_train: "privacyEnableFreeMayTrain",
		privacy_enable_free_may_publish_prompts: "privacyEnableFreeMayPublishPrompts", privacy_enable_input_output_logging: "privacyEnableInputOutputLogging",
		privacy_zdr_only: "privacyZdrOnly", provider_restriction_mode: "providerRestrictionMode",
		provider_restriction_provider_ids: "providerRestrictionProviderIds", provider_restriction_enforce_allowed: "providerRestrictionEnforceAllowed",
		model_restriction_mode: "modelRestrictionMode", allowed_api_model_ids: "allowedApiModelIds",
		prompt_injection_enabled: "promptInjectionEnabled", prompt_injection_action: "promptInjectionAction",
		sensitive_info_enabled: "sensitiveInfoEnabled", sensitive_info_default_action: "sensitiveInfoDefaultAction",
		sensitive_info_rules: "sensitiveInfoRules", daily_limit_requests: "dailyLimitRequests",
		weekly_limit_requests: "weeklyLimitRequests", monthly_limit_requests: "monthlyLimitRequests",
		daily_limit_cost_nanos: "dailyLimitCostNanos", weekly_limit_cost_nanos: "weeklyLimitCostNanos",
		monthly_limit_cost_nanos: "monthlyLimitCostNanos",
	};
	for (const [key, value] of Object.entries(patch)) mapped[names[key] ?? key] = value;
	return mapped as GuardrailPatch;
}

function parseGuardrailResourceId(url: URL): string | null {
	const segments = url.pathname.split("/").filter(Boolean);
	const guardrailsIndex = segments.lastIndexOf("guardrails");
	if (guardrailsIndex < 0) return null;
	const candidate = segments[guardrailsIndex + 1];
	if (!candidate) return null;
	return decodeURIComponent(candidate).trim() || null;
}

async function handleListGuardrails(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.GUARDRAILS_READ);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin", "member"]);
	if (roleError) return roleError;

	const url = new URL(req.url);
	const offset = parseOffset(url.searchParams.get("offset"));
	const limit = parsePositiveInt(url.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);

	try {
		const data = await listGuardrails(auth.value.workspaceId, limit, offset);
		return json({ data }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("guardrails.list", error);
	}
}

async function handleCreateGuardrail(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.GUARDRAILS_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;
	const patch = normalizeGuardrailPatch(body);
	if (!patch.name) return json({ error: "bad_request", message: "name is required" }, 400, { "Cache-Control": "no-store" });

	try {
		const data = await createGuardrail(auth.value.workspaceId, String(patch.name), toGuardrailPatch(patch));
		await bumpWorkspacePolicyVersion(auth.value.workspaceId);
		return json({ data }, 201, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("guardrails.create", error);
	}
}

async function handleGetGuardrail(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.GUARDRAILS_READ);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin", "member"]);
	if (roleError) return roleError;

	const id = parsePathId(new URL(req.url), "guardrails");
	if (!id) return json({ error: "bad_request", message: "Guardrail id is required" }, 400, { "Cache-Control": "no-store" });
	try {
		const guardrail = await findGuardrail(auth.value.workspaceId, id);
		if (!guardrail) return json({ error: "not_found", message: "Guardrail not found" }, 404, { "Cache-Control": "no-store" });
		const keyIds = await listGuardrailKeyIds(id);
		return json({ data: { ...guardrail, key_ids: keyIds } }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("guardrails.get", error);
	}
}

async function handleUpdateGuardrail(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.GUARDRAILS_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const id = parsePathId(new URL(req.url), "guardrails");
	if (!id) return json({ error: "bad_request", message: "Guardrail id is required" }, 400, { "Cache-Control": "no-store" });
	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;
	const patch = normalizeGuardrailPatch(body);
	if (Object.keys(patch).length === 0) {
		return json({ error: "bad_request", message: "No supported guardrail fields were provided" }, 400, { "Cache-Control": "no-store" });
	}

	try {
		const data = await updateGuardrail(auth.value.workspaceId, id, toGuardrailPatch(patch));
		if (!data) return json({ error: "not_found", message: "Guardrail not found" }, 404, { "Cache-Control": "no-store" });
		await bumpWorkspacePolicyVersion(auth.value.workspaceId);
		return json({ data }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("guardrails.update", error);
	}
}

async function handleDeleteGuardrail(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.GUARDRAILS_DELETE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const id = parsePathId(new URL(req.url), "guardrails");
	if (!id) return json({ error: "bad_request", message: "Guardrail id is required" }, 400, { "Cache-Control": "no-store" });
	try {
		const guardrail = await findGuardrail(auth.value.workspaceId, id);
		if (!guardrail) return json({ error: "not_found", message: "Guardrail not found" }, 404, { "Cache-Control": "no-store" });
		if (!await deleteGuardrail(auth.value.workspaceId, id)) throw new Error("Failed to delete guardrail");
		await bumpWorkspacePolicyVersion(auth.value.workspaceId);
		return json({ deleted: true }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("guardrails.delete", error);
	}
}

async function handleSetGuardrailKeys(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.GUARDRAILS_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;
	const id = parseGuardrailResourceId(new URL(req.url));
	if (!id) return json({ error: "bad_request", message: "Guardrail id is required" }, 400, { "Cache-Control": "no-store" });
	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;
	const keyIds = Array.isArray(body.key_ids) ? body.key_ids.map((item) => String(item)).filter(Boolean) : [];

	try {
		const guardrail = await findGuardrail(auth.value.workspaceId, id);
		if (!guardrail) return json({ error: "not_found", message: "Guardrail not found" }, 404, { "Cache-Control": "no-store" });
		if (keyIds.length) {
			const validKeyIds = await validWorkspaceKeyIds(auth.value.workspaceId, keyIds);
			if (keyIds.some((keyId) => !validKeyIds.has(keyId))) {
				return json({ error: "bad_request", message: "One or more keys do not belong to this workspace" }, 400, { "Cache-Control": "no-store" });
			}
		}
		await replaceGuardrailKeys(id, keyIds);
		await bumpWorkspacePolicyVersion(auth.value.workspaceId);
		return json({ data: { guardrail_id: id, key_ids: keyIds } }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("guardrails.keys.add", error);
	}
}

async function handleListGuardrailKeys(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.GUARDRAILS_READ);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin", "member"]);
	if (roleError) return roleError;

	const id = parseGuardrailResourceId(new URL(req.url));
	if (!id) return json({ error: "bad_request", message: "Guardrail id is required" }, 400, { "Cache-Control": "no-store" });

	try {
		const guardrail = await findGuardrail(auth.value.workspaceId, id);
		if (!guardrail) return json({ error: "not_found", message: "Guardrail not found" }, 404, { "Cache-Control": "no-store" });
		const assignments = await listGuardrailKeyAssignments(auth.value.workspaceId, id);
		return json({ data: assignments, total_count: assignments.length }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("guardrails.keys.list", error);
	}
}

async function handleAddGuardrailKeys(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.GUARDRAILS_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const id = parseGuardrailResourceId(new URL(req.url));
	if (!id) return json({ error: "bad_request", message: "Guardrail id is required" }, 400, { "Cache-Control": "no-store" });
	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;
	const keyIds = Array.isArray(body.key_ids)
		? Array.from(new Set(body.key_ids.map((item) => String(item ?? "").trim()).filter(Boolean)))
		: [];
	if (!keyIds.length) {
		return json({ error: "bad_request", message: "key_ids must contain at least one key id" }, 400, { "Cache-Control": "no-store" });
	}

	try {
		const guardrail = await findGuardrail(auth.value.workspaceId, id);
		if (!guardrail) return json({ error: "not_found", message: "Guardrail not found" }, 404, { "Cache-Control": "no-store" });

		const validKeyIds = await validWorkspaceKeyIds(auth.value.workspaceId, keyIds);
		if (keyIds.some((keyId) => !validKeyIds.has(keyId))) {
			return json({ error: "bad_request", message: "One or more keys do not belong to this workspace" }, 400, { "Cache-Control": "no-store" });
		}

		await addGuardrailKeys(id, keyIds);

		const assignments = await listGuardrailKeyAssignments(auth.value.workspaceId, id);
		const added = assignments.filter((assignment) => keyIds.includes(assignment.key_id));
		await bumpWorkspacePolicyVersion(auth.value.workspaceId);
		return json({ added_count: added.length, data: added }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("guardrails.keys.assign", error);
	}
}

async function handleRemoveGuardrailKeys(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.GUARDRAILS_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const id = parseGuardrailResourceId(new URL(req.url));
	if (!id) return json({ error: "bad_request", message: "Guardrail id is required" }, 400, { "Cache-Control": "no-store" });
	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;
	const keyIds = Array.isArray(body.key_ids)
		? Array.from(new Set(body.key_ids.map((item) => String(item ?? "").trim()).filter(Boolean)))
		: [];
	if (!keyIds.length) {
		return json({ error: "bad_request", message: "key_ids must contain at least one key id" }, 400, { "Cache-Control": "no-store" });
	}

	try {
		const guardrail = await findGuardrail(auth.value.workspaceId, id);
		if (!guardrail) return json({ error: "not_found", message: "Guardrail not found" }, 404, { "Cache-Control": "no-store" });

		const count = await removeGuardrailKeys(id, keyIds);
		await bumpWorkspacePolicyVersion(auth.value.workspaceId);
		return json({ removed_count: count ?? 0 }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("guardrails.keys.remove", error);
	}
}

async function handleListGuardrailMembers(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.GUARDRAILS_READ);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin", "member"]);
	if (roleError) return roleError;

	const id = parseGuardrailResourceId(new URL(req.url));
	if (!id) return json({ error: "bad_request", message: "Guardrail id is required" }, 400, { "Cache-Control": "no-store" });

	try {
		const guardrail = await findGuardrail(auth.value.workspaceId, id);
		if (!guardrail) return json({ error: "not_found", message: "Guardrail not found" }, 404, { "Cache-Control": "no-store" });
		const assignments = await listGuardrailMemberAssignments(auth.value.workspaceId, id);
		return json({ data: assignments, total_count: assignments.length }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("guardrails.members.list", error);
	}
}

async function handleAddGuardrailMembers(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.GUARDRAILS_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const id = parseGuardrailResourceId(new URL(req.url));
	if (!id) return json({ error: "bad_request", message: "Guardrail id is required" }, 400, { "Cache-Control": "no-store" });
	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;
	const userIds = Array.isArray(body.user_ids)
		? Array.from(new Set(body.user_ids.map((item) => String(item ?? "").trim()).filter(Boolean)))
		: [];
	if (!userIds.length) {
		return json({ error: "bad_request", message: "user_ids must contain at least one user id" }, 400, { "Cache-Control": "no-store" });
	}

	try {
		const guardrail = await findGuardrail(auth.value.workspaceId, id);
		if (!guardrail) return json({ error: "not_found", message: "Guardrail not found" }, 404, { "Cache-Control": "no-store" });

		const validUserIds = await validWorkspaceMemberIds(auth.value.workspaceId, userIds);
		if (userIds.some((userId) => !validUserIds.has(userId))) {
			return json({ error: "bad_request", message: "One or more users are not members of this workspace" }, 400, { "Cache-Control": "no-store" });
		}

		await addGuardrailMembers(auth.value.workspaceId, id, userIds);

		const assignments = await listGuardrailMemberAssignments(auth.value.workspaceId, id);
		const added = assignments.filter((assignment) => userIds.includes(assignment.user_id));
		await bumpWorkspacePolicyVersion(auth.value.workspaceId);
		return json({ added_count: added.length, data: added }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("guardrails.members.assign", error);
	}
}

async function handleRemoveGuardrailMembers(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.GUARDRAILS_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const id = parseGuardrailResourceId(new URL(req.url));
	if (!id) return json({ error: "bad_request", message: "Guardrail id is required" }, 400, { "Cache-Control": "no-store" });
	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;
	const userIds = Array.isArray(body.user_ids)
		? Array.from(new Set(body.user_ids.map((item) => String(item ?? "").trim()).filter(Boolean)))
		: [];
	if (!userIds.length) {
		return json({ error: "bad_request", message: "user_ids must contain at least one user id" }, 400, { "Cache-Control": "no-store" });
	}

	try {
		const guardrail = await findGuardrail(auth.value.workspaceId, id);
		if (!guardrail) return json({ error: "not_found", message: "Guardrail not found" }, 404, { "Cache-Control": "no-store" });

		const count = await removeGuardrailMembers(auth.value.workspaceId, id, userIds);
		await bumpWorkspacePolicyVersion(auth.value.workspaceId);
		return json({ removed_count: count ?? 0 }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("guardrails.members.remove", error);
	}
}

export const guardrailsRoutes = new Hono<Env>();

guardrailsRoutes.get("/", withRuntime(handleListGuardrails));
guardrailsRoutes.post("/", withRuntime(handleCreateGuardrail));
guardrailsRoutes.get("/:id", withRuntime(handleGetGuardrail));
guardrailsRoutes.patch("/:id", withRuntime(handleUpdateGuardrail));
guardrailsRoutes.delete("/:id", withRuntime(handleDeleteGuardrail));
guardrailsRoutes.get("/:id/keys", withRuntime(handleListGuardrailKeys));
guardrailsRoutes.post("/:id/keys/add", withRuntime(handleAddGuardrailKeys));
guardrailsRoutes.post("/:id/keys/remove", withRuntime(handleRemoveGuardrailKeys));
guardrailsRoutes.get("/:id/members", withRuntime(handleListGuardrailMembers));
guardrailsRoutes.post("/:id/members/add", withRuntime(handleAddGuardrailMembers));
guardrailsRoutes.post("/:id/members/remove", withRuntime(handleRemoveGuardrailMembers));
guardrailsRoutes.put("/:id/keys", withRuntime(handleSetGuardrailKeys));
