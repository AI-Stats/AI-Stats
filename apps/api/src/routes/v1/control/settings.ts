import { Hono } from "hono";
import type { Env } from "@/runtime/types";
import {
	findWorkspaceSettings,
	listActiveWorkspaceKeyIds,
	updateWorkspaceSettings,
	type WorkspaceSettingsPatch,
} from "@/repositories/workspace-settings";
import { setKeyVersion } from "@/core/kv";
import { guardManagementAuth, type GuardErr } from "@/pipeline/before/guards";
import { bumpWorkspacePolicyVersion } from "@/pipeline/before/workspacePolicy";
import { CAPABILITIES } from "@/lib/authz/capabilities";
import { json, withRuntime } from "@/routes/utils";
import {
	isResponse,
	internalServerError,
	requireJsonBody,
	requireCapability,
	requireOAuthWorkspaceRole,
} from "./route-helpers";

const WRITABLE_FIELDS = new Set([
	"routing_mode",
	"beta_channel_enabled",
	"alpha_channel_enabled",
	"response_healing_enabled",
	"response_healing_locked",
	"response_healing_mode",
	"byok_fallback_enabled",
	"privacy_enable_paid_may_train",
	"privacy_enable_free_may_train",
	"privacy_enable_free_may_publish_prompts",
	"privacy_enable_input_output_logging",
	"privacy_zdr_only",
	"io_logging_enabled",
	"io_logging_include_provider_payloads",
	"provider_restriction_mode",
	"provider_restriction_provider_ids",
	"provider_restriction_enforce_allowed",
]);

const CAMEL_TO_SNAKE: Record<string, string> = {
	routingMode: "routing_mode",
	betaChannelEnabled: "beta_channel_enabled",
	alphaChannelEnabled: "alpha_channel_enabled",
	responseHealingEnabled: "response_healing_enabled",
	responseHealingLocked: "response_healing_locked",
	responseHealingMode: "response_healing_mode",
	byokFallbackEnabled: "byok_fallback_enabled",
	privacyEnablePaidMayTrain: "privacy_enable_paid_may_train",
	privacyEnableFreeMayTrain: "privacy_enable_free_may_train",
	privacyEnableFreeMayPublishPrompts: "privacy_enable_free_may_publish_prompts",
	privacyEnableInputOutputLogging: "privacy_enable_input_output_logging",
	privacyZdrOnly: "privacy_zdr_only",
	ioLoggingEnabled: "io_logging_enabled",
	ioLoggingIncludeProviderPayloads: "io_logging_include_provider_payloads",
	providerRestrictionMode: "provider_restriction_mode",
	providerRestrictionProviderIds: "provider_restriction_provider_ids",
	providerRestrictionEnforceAllowed: "provider_restriction_enforce_allowed",
};

const WORKSPACE_POLICY_FIELDS = new Set([
	"provider_restriction_mode",
	"provider_restriction_provider_ids",
	"provider_restriction_enforce_allowed",
]);

const GATEWAY_CONTEXT_FIELDS = new Set([
	"routing_mode",
	"beta_channel_enabled",
	"alpha_channel_enabled",
	"response_healing_enabled",
	"response_healing_locked",
	"response_healing_mode",
	"byok_fallback_enabled",
	"cache_aware_routing_enabled",
	"privacy_enable_paid_may_train",
	"privacy_enable_free_may_train",
	"privacy_enable_input_output_logging",
	"privacy_zdr_only",
	"io_logging_enabled",
	"io_logging_include_provider_payloads",
]);

function normalizeSettingsPatch(body: Record<string, unknown>): Record<string, unknown> {
	const patch: Record<string, unknown> = {};
	for (const [rawKey, value] of Object.entries(body)) {
		const key = CAMEL_TO_SNAKE[rawKey] ?? rawKey;
		if (WRITABLE_FIELDS.has(key)) patch[key] = value;
	}
	if (patch.beta_channel_enabled === false) {
		patch.alpha_channel_enabled = false;
	}
	return patch;
}

async function invalidateWorkspaceGatewayContextCache(workspaceId: string): Promise<void> {
	const keyIds = await listActiveWorkspaceKeyIds(workspaceId);
	const nowVersion = Date.now();
	await Promise.all(keyIds.map((keyId) => setKeyVersion("id", keyId, nowVersion)));
}

function toDatabasePatch(patch: Record<string, unknown>): WorkspaceSettingsPatch {
	return {
		routingMode: typeof patch.routing_mode === "string" ? patch.routing_mode : undefined,
		betaChannelEnabled: typeof patch.beta_channel_enabled === "boolean" ? patch.beta_channel_enabled : undefined,
		alphaChannelEnabled: typeof patch.alpha_channel_enabled === "boolean" ? patch.alpha_channel_enabled : undefined,
		responseHealingEnabled: typeof patch.response_healing_enabled === "boolean" ? patch.response_healing_enabled : undefined,
		responseHealingLocked: typeof patch.response_healing_locked === "boolean" ? patch.response_healing_locked : undefined,
		responseHealingMode: typeof patch.response_healing_mode === "string" ? patch.response_healing_mode : undefined,
		byokFallbackEnabled: typeof patch.byok_fallback_enabled === "boolean" ? patch.byok_fallback_enabled : undefined,
		privacyEnablePaidMayTrain: typeof patch.privacy_enable_paid_may_train === "boolean" ? patch.privacy_enable_paid_may_train : undefined,
		privacyEnableFreeMayTrain: typeof patch.privacy_enable_free_may_train === "boolean" ? patch.privacy_enable_free_may_train : undefined,
		privacyEnableFreeMayPublishPrompts: typeof patch.privacy_enable_free_may_publish_prompts === "boolean" ? patch.privacy_enable_free_may_publish_prompts : undefined,
		privacyEnableInputOutputLogging: typeof patch.privacy_enable_input_output_logging === "boolean" ? patch.privacy_enable_input_output_logging : undefined,
		privacyZdrOnly: typeof patch.privacy_zdr_only === "boolean" ? patch.privacy_zdr_only : undefined,
		ioLoggingEnabled: typeof patch.io_logging_enabled === "boolean" ? patch.io_logging_enabled : undefined,
		ioLoggingIncludeProviderPayloads: typeof patch.io_logging_include_provider_payloads === "boolean" ? patch.io_logging_include_provider_payloads : undefined,
		providerRestrictionMode: typeof patch.provider_restriction_mode === "string" ? patch.provider_restriction_mode : undefined,
		providerRestrictionProviderIds: Array.isArray(patch.provider_restriction_provider_ids)
			? patch.provider_restriction_provider_ids.filter((value): value is string => typeof value === "string")
			: undefined,
		providerRestrictionEnforceAllowed: typeof patch.provider_restriction_enforce_allowed === "boolean" ? patch.provider_restriction_enforce_allowed : undefined,
	};
}

function serializeSettings(row: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(row).map(([key, value]) => [
		key.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`),
		value,
	]));
}

async function handleGetSettings(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.SETTINGS_READ);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin", "member"]);
	if (roleError) return roleError;

	try {
		const data = await findWorkspaceSettings(auth.value.workspaceId);
		return json({ data: data ? serializeSettings(data) : { workspace_id: auth.value.workspaceId, routing_mode: "balanced" } }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("settings.get", error);
	}
}

async function handleUpdateSettings(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.SETTINGS_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;
	const patch = normalizeSettingsPatch(body);
	if (Object.keys(patch).length === 0) {
		return json({ error: "bad_request", message: "No supported settings fields were provided" }, 400, { "Cache-Control": "no-store" });
	}

	try {
		const data = await updateWorkspaceSettings(auth.value.workspaceId, toDatabasePatch(patch));
		if (Object.keys(patch).some((field) => WORKSPACE_POLICY_FIELDS.has(field))) {
			await bumpWorkspacePolicyVersion(auth.value.workspaceId);
		}
		if (Object.keys(patch).some((field) => GATEWAY_CONTEXT_FIELDS.has(field))) {
			await invalidateWorkspaceGatewayContextCache(auth.value.workspaceId);
		}
		return json({ data: data ? serializeSettings(data) : null }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("settings.update", error);
	}
}

export const settingsRoutes = new Hono<Env>();

settingsRoutes.get("/", withRuntime(handleGetSettings));
settingsRoutes.patch("/", withRuntime(handleUpdateSettings));
