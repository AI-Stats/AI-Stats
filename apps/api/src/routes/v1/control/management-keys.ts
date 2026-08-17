import { Hono } from "hono";
import type { Env } from "@/runtime/types";
import { getBindings } from "@/runtime/env";
import {
	createManagementKey,
	deleteManagementKey,
	findManagementKey,
	listManagementKeys,
	updateManagementKey,
} from "@/repositories/management-keys";
import { findWorkspaceOwnerUserId } from "@/repositories/management";
import { guardManagementAuth, type GuardErr } from "@/pipeline/before/guards";
import { CAPABILITIES, parseStoredScopeList } from "@/lib/authz/capabilities";
import {
	isManagementKeyTemplate,
	MANAGEMENT_KEY_TEMPLATES,
} from "@/lib/authz/management-key-templates";
import { json, withRuntime } from "@/routes/utils";
import {
	generateManagementKey,
	hmacSecret,
	normalizeScopeInput,
} from "@/routes/auth.helpers";
import { resolveActiveKeyPepper } from "@/lib/security/keyPepper";
import { enforceWorkspaceKeyLimit } from "./management-helpers";
import {
	isResponse,
	internalServerError,
	parseOffset,
	parsePathId,
	parsePositiveInt,
	requireJsonBody,
	requireCapability,
	requireOAuthWorkspaceRole,
} from "./route-helpers";

type ManagementKeyRow = Record<string, unknown> & {
	id: string;
	workspace_id: string;
	name?: string | null;
	status?: string | null;
};

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 250;

function parseOptionalExpiry(raw: unknown): string | null | undefined {
	if (raw === undefined) return undefined;
	if (raw === null || String(raw).trim() === "") return null;
	const parsed = new Date(String(raw));
	if (Number.isNaN(parsed.getTime())) throw new Error("expires_at must be a valid ISO-8601 datetime or null");
	return parsed.toISOString();
}

function resolveManagementKeyScopes(body: Record<string, unknown>) {
	if (body.template !== undefined && body.scopes !== undefined) {
		return {
			ok: false as const,
			message: "Provide either template or scopes, not both",
		};
	}

	if (body.template !== undefined) {
		if (!isManagementKeyTemplate(body.template)) {
			return {
				ok: false as const,
				message: `Unsupported management key template: ${String(body.template)}`,
			};
		}
		const scopes = normalizeScopeInput(MANAGEMENT_KEY_TEMPLATES[body.template].scopes);
		return scopes.ok ? { ...scopes, template: body.template } : scopes;
	}

	if (body.scopes === undefined || body.scopes === null) {
		return {
			ok: false as const,
			message: "template or scopes is required when creating a management key",
		};
	}

	const scopes = normalizeScopeInput(body.scopes);
	if (scopes.ok === false) return scopes;
	if (parseStoredScopeList(scopes.value).length === 0) {
		return { ok: false as const, message: "At least one management scope is required" };
	}
	return { ...scopes, template: null };
}

function requireGrantableScopes(
	auth: {
		internal?: boolean;
		authMethod?: "api_key" | "oauth";
		scopes?: string[];
		oauthScopes?: string[];
	},
	requestedScopes: string,
): Response | null {
	if (auth.internal) return null;

	const grantedScopes = new Set(
		auth.authMethod === "oauth"
			? (auth.scopes ?? auth.oauthScopes ?? [])
			: (auth.scopes ?? []),
	);
	const ungrantableScopes = parseStoredScopeList(requestedScopes).filter(
		(scope) => !grantedScopes.has(scope),
	);
	if (ungrantableScopes.length === 0) return null;

	return json(
		{
			error: "insufficient_scope",
			message: `Token cannot grant scopes it does not have: ${ungrantableScopes.join(", ")}`,
		},
		403,
		{ "Cache-Control": "no-store" },
	);
}

function formatManagementKey(row: ManagementKeyRow) {
	return {
		...row,
		scopes: parseStoredScopeList(row.scopes),
	};
}

async function issueManagementKey(args: {
	workspaceId: string;
	name: string;
	scopes: string;
	expiresAt: string | null;
	paused: boolean;
	createdBy: string | null;
}) {
	const pepper = resolveActiveKeyPepper(getBindings());
	if (!pepper) throw new Error("KEY_PEPPER_ACTIVE is not configured");

	await enforceWorkspaceKeyLimit(args.workspaceId);
	const generated = generateManagementKey();
	const hash = await hmacSecret(generated.secret, pepper);
	const createdBy = args.createdBy ?? await findWorkspaceOwnerUserId(args.workspaceId);
	if (!createdBy) throw new Error("Workspace owner not found");
	const data = await createManagementKey({
			workspaceId: args.workspaceId,
			name: args.name,
			kid: generated.kid,
			hash,
			prefix: generated.prefix,
			status: args.paused ? "paused" : "active",
			scopes: args.scopes,
			expiresAt: args.expiresAt,
			createdBy,
		});

	return {
		...formatManagementKey(data as unknown as ManagementKeyRow),
		key: generated.plaintext,
	};
}


async function handleListManagementKeys(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.MANAGEMENT_KEYS_READ);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const url = new URL(req.url);
	const offset = parseOffset(url.searchParams.get("offset"));
	const limit = parsePositiveInt(url.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
	try {
		const data = await listManagementKeys(auth.value.workspaceId, limit, offset);
		return json({ data: data.map((row) => formatManagementKey(row as unknown as ManagementKeyRow)) }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("management_keys.list", error);
	}
}

async function handleCreateManagementKey(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.MANAGEMENT_KEYS_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;
	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;
	const name = String(body.name ?? "").trim();
	if (!name) return json({ error: "bad_request", message: "name is required" }, 400, { "Cache-Control": "no-store" });

	try {
		const scopes = resolveManagementKeyScopes(body);
		if (scopes.ok === false) return json({ error: "bad_request", message: scopes.message }, 400, { "Cache-Control": "no-store" });
		const grantError = requireGrantableScopes(auth.value, scopes.value);
		if (grantError) return grantError;
		const expiresAt = parseOptionalExpiry(body.expires_at ?? body.expiresAt);
		const data = await issueManagementKey({
			workspaceId: auth.value.workspaceId,
			name,
			scopes: scopes.value,
			expiresAt: expiresAt ?? null,
			paused: body.paused === true,
			createdBy: auth.value.userId ?? null,
		});
		return json({ data }, 201, { "Cache-Control": "no-store" });
	} catch (error: any) {
		if (String(error?.message ?? "").includes("KEY_PEPPER_ACTIVE is not configured")) {
			return json(
				{ error: "server_misconfig_missing_pepper", message: "KEY_PEPPER_ACTIVE is not configured" },
				503,
				{ "Cache-Control": "no-store" },
			);
		}
		return internalServerError("management_keys.create", error);
	}
}


async function handleGetManagementKey(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.MANAGEMENT_KEYS_READ);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;
	const id = parsePathId(new URL(req.url), "management-keys");
	if (!id) return json({ error: "bad_request", message: "Management key id is required" }, 400, { "Cache-Control": "no-store" });
	try {
		const key = await findManagementKey(auth.value.workspaceId, id);
		if (!key) return json({ error: "not_found", message: "Management key not found" }, 404, { "Cache-Control": "no-store" });
		return json({ data: formatManagementKey(key) }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("management_keys.get", error);
	}
}

async function handleUpdateManagementKey(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.MANAGEMENT_KEYS_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;
	const id = parsePathId(new URL(req.url), "management-keys");
	if (!id) return json({ error: "bad_request", message: "Management key id is required" }, 400, { "Cache-Control": "no-store" });
	const body = await requireJsonBody(req);
	if (isResponse(body)) return body;

	try {
		const patch: Record<string, unknown> = {};
		if (typeof body.softBlocked === "boolean") patch.softBlocked = body.softBlocked;
		if (typeof body.name === "string") patch.name = body.name.trim();
		if (typeof body.paused === "boolean") patch.status = body.paused ? "paused" : "active";
		if (body.scopes !== undefined || body.template !== undefined) {
			if (body.scopes === null) {
				return json(
					{ error: "bad_request", message: "scopes must be omitted to keep existing scopes or provided as a string or string[]" },
					400,
					{ "Cache-Control": "no-store" },
				);
			}
			const scopes = resolveManagementKeyScopes(body);
			if (scopes.ok === false) return json({ error: "bad_request", message: scopes.message }, 400, { "Cache-Control": "no-store" });
			const grantError = requireGrantableScopes(auth.value, scopes.value);
			if (grantError) return grantError;
			patch.scopes = scopes.value;
		}
		if (typeof body.expires_at !== "undefined" || typeof body.expiresAt !== "undefined") {
			patch.expiresAt = parseOptionalExpiry(body.expires_at ?? body.expiresAt);
		}
		if (Object.keys(patch).length === 0) {
			return json({ error: "bad_request", message: "No supported management key fields were provided" }, 400, { "Cache-Control": "no-store" });
		}
		const data = await updateManagementKey(auth.value.workspaceId, id, patch);
		if (!data) return json({ error: "not_found", message: "Management key not found" }, 404, { "Cache-Control": "no-store" });
		return json({ data: formatManagementKey(data as unknown as ManagementKeyRow) }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("management_keys.update", error);
	}
}

async function handleDeleteManagementKey(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) return (auth as GuardErr).response;
	const scopeError = requireCapability(auth.value, CAPABILITIES.MANAGEMENT_KEYS_DELETE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;
	const id = parsePathId(new URL(req.url), "management-keys");
	if (!id) return json({ error: "bad_request", message: "Management key id is required" }, 400, { "Cache-Control": "no-store" });
	try {
		const deleted = await deleteManagementKey(auth.value.workspaceId, id);
		if (!deleted) return json({ error: "not_found", message: "Management key not found" }, 404, { "Cache-Control": "no-store" });
		return json({ deleted: true }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("management_keys.delete", error);
	}
}

export const managementKeysRoutes = new Hono<Env>();

managementKeysRoutes.get("/", withRuntime(handleListManagementKeys));
managementKeysRoutes.post("/", withRuntime(handleCreateManagementKey));
managementKeysRoutes.get("/:id", withRuntime(handleGetManagementKey));
managementKeysRoutes.patch("/:id", withRuntime(handleUpdateManagementKey));
managementKeysRoutes.delete("/:id", withRuntime(handleDeleteManagementKey));
