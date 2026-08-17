// Purpose: Workspace control-plane routes.
// Why: Exposes elevated workspace lifecycle operations behind management-key auth.
// How: Resolves the current workspace owner from the management key and scopes CRUD to that owner.

import { Hono } from "hono";
import type { Env } from "@/runtime/types";
import { listWorkspaceMembers } from "@/repositories/workspace-members";
import {
	countActiveWorkspaceKeys,
	createWorkspaceWithOwner,
	deleteWorkspaceByOwner,
	findExistingUserIds,
	findWorkspaceById,
	findWorkspaceMemberRoles,
	isDefaultWorkspaceForUser,
	removeWorkspaceMembers,
	updateWorkspaceByOwner,
	upsertWorkspaceMembers,
} from "@/repositories/workspaces";
import { findWorkspaceOwnerUserId } from "@/repositories/management";
import { guardManagementAuth, type GuardErr } from "@/pipeline/before/guards";
import { CAPABILITIES } from "@/lib/authz/capabilities";
import { json, withRuntime } from "@/routes/utils";
import { internalServerError, requireCapability, requireOAuthWorkspaceRole } from "./route-helpers";
import { ensureWorkspaceWalletProvisioned, userHasPaidWorkspaceAccess } from "./management-helpers";

type WorkspaceRow = {
	id: string;
	name: string | null;
	slug: string | null;
	owner_user_id: string | null;
	created_at?: string | null;
	updated_at?: string | null;
};

function parsePathId(url: URL): string | null {
	const segments = url.pathname.split("/").filter(Boolean);
	const candidate = segments.at(-1);
	if (!candidate || candidate === "workspaces") return null;
	return decodeURIComponent(candidate).trim() || null;
}

function parseWorkspaceResourceId(url: URL): string | null {
	const segments = url.pathname.split("/").filter(Boolean);
	const workspacesIndex = segments.lastIndexOf("workspaces");
	if (workspacesIndex < 0) return null;
	const candidate = segments[workspacesIndex + 1];
	if (!candidate) return null;
	return decodeURIComponent(candidate).trim() || null;
}

function isValidSlug(slug: string): boolean {
	return /^[a-z0-9-]{1,50}$/.test(slug);
}

function makeSlug(name: string): string {
	const base = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 42);
	const suffix = Date.now().toString(36).slice(-6);
	return `${base || "workspace"}-${suffix}`.slice(0, 50);
}

function formatWorkspace(row: WorkspaceRow) {
	return {
		id: row.id,
		name: row.name ?? null,
		slug: row.slug ?? null,
		created_by: row.owner_user_id ?? null,
		created_at: row.created_at ?? null,
		updated_at: row.updated_at ?? null,
	};
}

function isValidWorkspaceRole(value: unknown): value is "owner" | "admin" | "member" {
	const normalized = String(value ?? "").trim().toLowerCase();
	return normalized === "owner" || normalized === "admin" || normalized === "member";
}

async function resolveOwnerUserId(authWorkspaceId: string): Promise<string> {
	const ownerUserId = (await findWorkspaceOwnerUserId(authWorkspaceId))?.trim() ?? "";
	if (!ownerUserId) {
		throw new Error("Workspace owner not found");
	}
	return ownerUserId;
}

async function resolveAuthorizedWorkspace(authWorkspaceId: string, identifier: string): Promise<WorkspaceRow | null> {
	const workspace = await findWorkspaceById(authWorkspaceId);
	if (!workspace) return null;
	const normalizedIdentifier = identifier.trim();
	if (!normalizedIdentifier) return null;
	if (normalizedIdentifier === workspace.id) return workspace;
	if (normalizedIdentifier === String(workspace.slug ?? "").trim()) return workspace;
	return null;
}

async function cleanupProvisioningFailedWorkspace(workspaceId: string, ownerUserId: string): Promise<void> {
	const deleted = await deleteWorkspaceByOwner(workspaceId, ownerUserId);
	if (!deleted) throw new Error("Failed to roll back workspace after provisioning error");
}

async function resolveWorkspaceMembers(workspaceId: string) {
	return listWorkspaceMembers(workspaceId);
}

async function handleListWorkspaces(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) {
		return (auth as GuardErr).response;
	}
	const scopeError = requireCapability(auth.value, CAPABILITIES.WORKSPACES_READ);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	try {
		const workspace = await findWorkspaceById(auth.value.workspaceId);
		if (!workspace) {
			return json({ error: "not_found", message: "Workspace not found" }, 404, { "Cache-Control": "no-store" });
		}

		return json(
			{
				data: [formatWorkspace(workspace)],
				total_count: 1,
			},
			200,
			{ "Cache-Control": "no-store" },
		);
	} catch (error: any) {
		const message = String(error?.message ?? error);
		if (message.includes("Stripe customer provisioning is not configured")) {
			return json(
				{ error: "stripe_not_configured", message },
				503,
				{ "Cache-Control": "no-store" },
			);
		}
		return json({ error: "failed", message }, 500, { "Cache-Control": "no-store" });
	}
}

async function handleGetWorkspace(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) {
		return (auth as GuardErr).response;
	}
	const scopeError = requireCapability(auth.value, CAPABILITIES.WORKSPACES_READ);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const identifier = parsePathId(new URL(req.url));
	if (!identifier) {
		return json({ error: "bad_request", message: "Workspace id or slug is required" }, 400, { "Cache-Control": "no-store" });
	}

	try {
		const workspace = await resolveAuthorizedWorkspace(auth.value.workspaceId, identifier);
		if (!workspace) {
			return json({ error: "not_found", message: "Workspace not found" }, 404, { "Cache-Control": "no-store" });
		}
		return json({ data: formatWorkspace(workspace) }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("workspaces.get", error);
	}
}

async function handleCreateWorkspace(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) {
		return (auth as GuardErr).response;
	}
	const scopeError = requireCapability(auth.value, CAPABILITIES.WORKSPACES_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch (error) {
		if (error instanceof SyntaxError) {
			return json({ error: "invalid_json", message: "Invalid JSON body" }, 400, { "Cache-Control": "no-store" });
		}
		throw error;
	}

	const name = String(body.name ?? "").trim();
	if (!name || name.length > 100) {
		return json({ error: "bad_request", message: "name is required and must be 1-100 characters" }, 400, { "Cache-Control": "no-store" });
	}
	const requestedSlug = String(body.slug ?? "").trim().toLowerCase();
	const slug = requestedSlug || makeSlug(name);
	if (!isValidSlug(slug)) {
		return json({ error: "bad_request", message: "slug must match ^[a-z0-9-]+$ and be 1-50 characters" }, 400, { "Cache-Control": "no-store" });
	}

	try {
		const ownerUserId = await resolveOwnerUserId(auth.value.workspaceId);
		const hasPaidWorkspaceAccess = await userHasPaidWorkspaceAccess(ownerUserId);
		if (!hasPaidWorkspaceAccess) {
			return json(
				{
					error: "workspace_upgrade_required",
					message: "Additional workspaces unlock after your first credit deposit. Free accounts can use the personal workspace only.",
				},
				403,
				{ "Cache-Control": "no-store" },
			);
		}
		const data = await createWorkspaceWithOwner({ name, slug, ownerUserId });
		const workspaceId = data.id;
		try {
			await ensureWorkspaceWalletProvisioned({
				workspaceId,
				userId: ownerUserId,
			});
		} catch (error) {
			try {
				await cleanupProvisioningFailedWorkspace(workspaceId, ownerUserId);
			} catch (cleanupError) {
				const cleanupMessage = String((cleanupError as any)?.message ?? cleanupError);
				const originalMessage = String((error as any)?.message ?? error);
				throw new Error(`${originalMessage}; rollback_failed: ${cleanupMessage}`);
			}
			throw error;
		}

		return json({ data: formatWorkspace(data) }, 201, { "Cache-Control": "no-store" });
	} catch (error: any) {
		const message = String(error?.message ?? error);
		if (message.includes("Stripe customer provisioning is not configured")) {
			return json(
				{ error: "stripe_not_configured", message },
				503,
				{ "Cache-Control": "no-store" },
			);
		}
		return json({ error: "failed", message }, 500, { "Cache-Control": "no-store" });
	}
}

async function handleUpdateWorkspace(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) {
		return (auth as GuardErr).response;
	}
	const scopeError = requireCapability(auth.value, CAPABILITIES.WORKSPACES_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const identifier = parsePathId(new URL(req.url));
	if (!identifier) {
		return json({ error: "bad_request", message: "Workspace id or slug is required" }, 400, { "Cache-Control": "no-store" });
	}

	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch (error) {
		if (error instanceof SyntaxError) {
			return json({ error: "invalid_json", message: "Invalid JSON body" }, 400, { "Cache-Control": "no-store" });
		}
		throw error;
	}

	const updatePayload: Record<string, unknown> = {};
	if (typeof body.name === "string") {
		const name = body.name.trim();
		if (!name || name.length > 100) {
			return json({ error: "bad_request", message: "name must be 1-100 characters" }, 400, { "Cache-Control": "no-store" });
		}
		updatePayload.name = name;
	}
	if (typeof body.slug === "string") {
		const slug = body.slug.trim().toLowerCase();
		if (!isValidSlug(slug)) {
			return json({ error: "bad_request", message: "slug must match ^[a-z0-9-]+$ and be 1-50 characters" }, 400, { "Cache-Control": "no-store" });
		}
		updatePayload.slug = slug;
	}
	if (Object.keys(updatePayload).length === 0) {
		return json({ error: "bad_request", message: "No supported workspace fields were provided" }, 400, { "Cache-Control": "no-store" });
	}

	try {
		const existing = await resolveAuthorizedWorkspace(auth.value.workspaceId, identifier);
		if (!existing) {
			return json({ error: "not_found", message: "Workspace not found" }, 404, { "Cache-Control": "no-store" });
		}
		const ownerUserId = String(existing.owner_user_id ?? "").trim();
		if (!ownerUserId) {
			throw new Error("Workspace owner not found");
		}
		if (await isDefaultWorkspaceForUser(ownerUserId, existing.id)) {
			return json(
				{ error: "bad_request", message: "Personal workspace cannot be renamed." },
				400,
				{ "Cache-Control": "no-store" },
			);
		}

		const updated = await updateWorkspaceByOwner(existing.id, ownerUserId, {
			name: typeof updatePayload.name === "string" ? updatePayload.name : undefined,
			slug: typeof updatePayload.slug === "string" ? updatePayload.slug : undefined,
		});
		if (!updated) {
			throw new Error("Workspace update succeeded but refetch failed");
		}

		return json({ data: formatWorkspace(updated) }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("workspaces.update", error);
	}
}

async function handleDeleteWorkspace(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) {
		return (auth as GuardErr).response;
	}
	const scopeError = requireCapability(auth.value, CAPABILITIES.WORKSPACES_DELETE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const identifier = parsePathId(new URL(req.url));
	if (!identifier) {
		return json({ error: "bad_request", message: "Workspace id or slug is required" }, 400, { "Cache-Control": "no-store" });
	}

	try {
		const workspace = await resolveAuthorizedWorkspace(auth.value.workspaceId, identifier);
		if (!workspace) {
			return json({ error: "not_found", message: "Workspace not found" }, 404, { "Cache-Control": "no-store" });
		}
		const ownerUserId = String(workspace.owner_user_id ?? "").trim();
		if (!ownerUserId) {
			throw new Error("Workspace owner not found");
		}

		if (await isDefaultWorkspaceForUser(ownerUserId, workspace.id)) {
			return json({ error: "bad_request", message: "The default workspace cannot be deleted" }, 400, { "Cache-Control": "no-store" });
		}

		const activeKeyCount = await countActiveWorkspaceKeys(workspace.id);
		if (activeKeyCount > 0) {
			return json({ error: "bad_request", message: "Workspaces with active API keys cannot be deleted" }, 400, { "Cache-Control": "no-store" });
		}

		const deleted = await deleteWorkspaceByOwner(workspace.id, ownerUserId);
		if (!deleted) throw new Error("Workspace deletion did not remove a row");

		return json({ deleted: true }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("workspaces.delete", error);
	}
}

async function handleListWorkspaceMembers(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) {
		return (auth as GuardErr).response;
	}
	const scopeError = requireCapability(auth.value, CAPABILITIES.WORKSPACES_READ);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const identifier = parseWorkspaceResourceId(new URL(req.url));
	if (!identifier) {
		return json({ error: "bad_request", message: "Workspace id or slug is required" }, 400, { "Cache-Control": "no-store" });
	}

	try {
		const workspace = await resolveAuthorizedWorkspace(auth.value.workspaceId, identifier);
		if (!workspace) {
			return json({ error: "not_found", message: "Workspace not found" }, 404, { "Cache-Control": "no-store" });
		}
		const members = await resolveWorkspaceMembers(workspace.id);
		return json({ data: members, total_count: members.length }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("workspaces.members.list", error);
	}
}

async function handleAddWorkspaceMembers(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) {
		return (auth as GuardErr).response;
	}
	const scopeError = requireCapability(auth.value, CAPABILITIES.WORKSPACES_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const identifier = parseWorkspaceResourceId(new URL(req.url));
	if (!identifier) {
		return json({ error: "bad_request", message: "Workspace id or slug is required" }, 400, { "Cache-Control": "no-store" });
	}

	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch (error) {
		if (error instanceof SyntaxError) {
			return json({ error: "invalid_json", message: "Invalid JSON body" }, 400, { "Cache-Control": "no-store" });
		}
		throw error;
	}

	const userIds = Array.isArray(body.user_ids)
		? body.user_ids.map((value) => String(value ?? "").trim()).filter(Boolean)
		: [];
	if (!userIds.length) {
		return json({ error: "bad_request", message: "user_ids must contain at least one user id" }, 400, { "Cache-Control": "no-store" });
	}

	const requestedRole = String(body.role ?? "member").trim().toLowerCase();
	if (!isValidWorkspaceRole(requestedRole) || requestedRole === "owner") {
		return json({ error: "bad_request", message: "role must be admin or member" }, 400, { "Cache-Control": "no-store" });
	}

	try {
		const workspace = await resolveAuthorizedWorkspace(auth.value.workspaceId, identifier);
		if (!workspace) {
			return json({ error: "not_found", message: "Workspace not found" }, 404, { "Cache-Control": "no-store" });
		}

		const existingUserIds = await findExistingUserIds(userIds);
		if (userIds.some((userId) => !existingUserIds.has(userId))) {
			return json({ error: "bad_request", message: "One or more users do not exist" }, 400, { "Cache-Control": "no-store" });
		}

		const uniqueUserIds = Array.from(new Set(userIds));
		await upsertWorkspaceMembers(workspace.id, uniqueUserIds, requestedRole);

		const members = await resolveWorkspaceMembers(workspace.id);
		const added = members.filter((member) => uniqueUserIds.includes(member.user_id));
		return json({ added_count: added.length, data: added }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("workspaces.members.add", error);
	}
}

async function handleRemoveWorkspaceMembers(req: Request) {
	const auth = await guardManagementAuth(req, { useKvCache: false });
	if (!auth.ok) {
		return (auth as GuardErr).response;
	}
	const scopeError = requireCapability(auth.value, CAPABILITIES.WORKSPACES_WRITE);
	if (scopeError) return scopeError;
	const roleError = await requireOAuthWorkspaceRole(auth.value, auth.value.workspaceId, ["owner", "admin"]);
	if (roleError) return roleError;

	const identifier = parseWorkspaceResourceId(new URL(req.url));
	if (!identifier) {
		return json({ error: "bad_request", message: "Workspace id or slug is required" }, 400, { "Cache-Control": "no-store" });
	}

	let body: Record<string, unknown>;
	try {
		body = (await req.json()) as Record<string, unknown>;
	} catch (error) {
		if (error instanceof SyntaxError) {
			return json({ error: "invalid_json", message: "Invalid JSON body" }, 400, { "Cache-Control": "no-store" });
		}
		throw error;
	}

	const userIds = Array.isArray(body.user_ids)
		? Array.from(new Set(body.user_ids.map((value) => String(value ?? "").trim()).filter(Boolean)))
		: [];
	if (!userIds.length) {
		return json({ error: "bad_request", message: "user_ids must contain at least one user id" }, 400, { "Cache-Control": "no-store" });
	}

	try {
		const workspace = await resolveAuthorizedWorkspace(auth.value.workspaceId, identifier);
		if (!workspace) {
			return json({ error: "not_found", message: "Workspace not found" }, 404, { "Cache-Control": "no-store" });
		}
		const ownerUserId = String(workspace.owner_user_id ?? "").trim();
		if (!ownerUserId) {
			throw new Error("Workspace owner not found");
		}
		if (userIds.includes(ownerUserId)) {
			return json({ error: "bad_request", message: "Workspace owner cannot be removed" }, 400, { "Cache-Control": "no-store" });
		}

		const existingMembers = await findWorkspaceMemberRoles(workspace.id, userIds);
		if (existingMembers.some((member) => member.role === "owner")) {
			return json({ error: "bad_request", message: "Workspace owner cannot be removed" }, 400, { "Cache-Control": "no-store" });
		}

		const removedCount = await removeWorkspaceMembers(workspace.id, userIds);
		return json({ removed_count: removedCount }, 200, { "Cache-Control": "no-store" });
	} catch (error: any) {
		return internalServerError("workspaces.members.remove", error);
	}
}

export const workspacesRoutes = new Hono<Env>();

workspacesRoutes.get("/", withRuntime(handleListWorkspaces));
workspacesRoutes.post("/", withRuntime(handleCreateWorkspace));
workspacesRoutes.get("/:id", withRuntime(handleGetWorkspace));
workspacesRoutes.patch("/:id", withRuntime(handleUpdateWorkspace));
workspacesRoutes.delete("/:id", withRuntime(handleDeleteWorkspace));
workspacesRoutes.get("/:id/members", withRuntime(handleListWorkspaceMembers));
workspacesRoutes.post("/:id/members/add", withRuntime(handleAddWorkspaceMembers));
workspacesRoutes.post("/:id/members/remove", withRuntime(handleRemoveWorkspaceMembers));
