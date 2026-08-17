import { Hono } from "hono";
import { requireUser } from "@/auth/requireUser";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { acceptWorkspaceInvite, canCreateWorkspace, createWorkspace, createWorkspaceInvite, decideWorkspaceJoinRequest, deleteWorkspaceInvite, findWorkspaceInvite, getMemberRole, getTeamsDashboard, getWorkspaceSso, removeWorkspace, removeWorkspaceMember, renameWorkspace, saveWorkspaceSso, setWorkspaceMemberRole } from "@/repositories/teams";
import { requireAccountWorkspace } from "./context";

const emptyTeams = {
	teams: [], membersByTeam: {}, invitesByTeam: {}, requestsByTeam: {},
	initialTeamId: null, currentUserId: null, personalTeamId: null,
	manageableTeamIds: [], walletBalances: {}, teamSsoSettingsByTeam: {},
};

const SSO_DOMAIN_PATTERN =
	/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeWorkspaceSsoUpdate(body: Record<string, unknown>) {
	const requestedMode = String(body.ssoMode ?? "none").trim().toLowerCase();
	const mode = requestedMode === "saml" || requestedMode === "custom_oidc"
		? requestedMode
		: "none";
	const enabled = Boolean(body.ssoEnabled);
	const enforced = enabled && Boolean(body.ssoEnforced);
	const identifier = mode === "none"
		? null
		: String(body.ssoProviderIdentifier ?? "").trim() || null;
	const rawDomains = Array.isArray(body.ssoDomains)
		? body.ssoDomains.map((value) =>
				String(value ?? "").trim().toLowerCase().replace(/^\.+|\.+$/g, ""),
			)
		: [];
	const invalidDomain = rawDomains.find(
		(domain) => domain.length > 0 && !SSO_DOMAIN_PATTERN.test(domain),
	);
	if (invalidDomain) return { error: "invalid_sso_domain" as const };
	const domains = Array.from(
		new Set(rawDomains.filter((domain) => SSO_DOMAIN_PATTERN.test(domain))),
	);

	if (enforced) return { error: "sso_enforcement_not_available" as const };
	if (enabled && mode === "none") return { error: "sso_mode_required" as const };
	if (mode === "saml" && identifier && !UUID_PATTERN.test(identifier)) {
		return { error: "invalid_saml_provider_id" as const };
	}
	if (mode === "custom_oidc" && identifier && !identifier.startsWith("custom:")) {
		return { error: "invalid_provider_identifier" as const };
	}
	if (enabled && !identifier) return { error: "sso_provider_required" as const };
	if (enabled && domains.length === 0) return { error: "sso_domain_required" as const };

	return {
		value: {
			sso_enabled: enabled,
			sso_enforced: false,
			sso_mode: mode,
			sso_provider_identifier: identifier,
			sso_domains: domains,
		},
	};
}

function base64ToBytes(value: string): Uint8Array {
	return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function bytesToBase64(value: Uint8Array): string {
	let binary = "";
	for (const byte of value) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function bytesBuffer(value: Uint8Array): ArrayBuffer {
	return new Uint8Array(value).buffer;
}

async function inviteAesKey(env: Env) {
	const bytes = base64ToBytes(env.INVITE_ENCRYPTION_KEY ?? "");
	if (bytes.length !== 32) throw new Error("invite_encryption_unavailable");
	return crypto.subtle.importKey("raw", bytesBuffer(bytes), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptInviteToken(env: Env, token: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, await inviteAesKey(env), new TextEncoder().encode(token)));
	const ciphertext = encrypted.slice(0, -16);
	const tag = encrypted.slice(-16);
	const output = new Uint8Array(iv.length + tag.length + ciphertext.length);
	output.set(iv, 0); output.set(tag, iv.length); output.set(ciphertext, iv.length + tag.length);
	return bytesToBase64(output);
}

async function decryptInviteToken(env: Env, payload: string): Promise<string> {
	const bytes = base64ToBytes(payload);
	if (bytes.length < 29) throw new Error("malformed_invite");
	const iv = bytes.slice(0, 12); const tag = bytes.slice(12, 28); const ciphertext = bytes.slice(28);
	const encrypted = new Uint8Array(ciphertext.length + tag.length); encrypted.set(ciphertext); encrypted.set(tag, ciphertext.length);
	return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, await inviteAesKey(env), encrypted));
}

async function inviteFingerprint(env: Env, token: string): Promise<string> {
	const keyBytes = base64ToBytes(env.HMAC_ENCRYPTION_KEY ?? "");
	if (!keyBytes.length) throw new Error("invite_hmac_unavailable");
	const key = await crypto.subtle.importKey("raw", bytesBuffer(keyBytes), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token)));
	return [...signature].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function upsertLinearCustomer(env: Env, args: { workspaceId: string; name: string }) {
	if (!env.LINEAR_API_KEY || !env.LINEAR_DEFAULT_ASSIGNED_USER_ID) return;
	const query = `mutation CustomerUpsert($input: CustomerUpsertInput!) { customerUpsert(input: $input) { success customer { id } } }`;
	await fetch("https://api.linear.app/graphql", { method: "POST", headers: { "content-type": "application/json", authorization: env.LINEAR_API_KEY.replace(/^Bearer\s+/i, "") }, body: JSON.stringify({ query, variables: { input: { externalId: `cus-${args.workspaceId}`, name: args.name, ownerId: env.LINEAR_DEFAULT_ASSIGNED_USER_ID, tierId: env.LINEAR_DEFAULT_TIER_ID || undefined } } }) });
}

export const accountSettingsTeamsRouter = new Hono<{ Bindings: Env }>();

accountSettingsTeamsRouter.get("/teams", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json(emptyTeams, 200, PRIVATE_NO_STORE_HEADERS);
	let data; try { data = await getTeamsDashboard(c.env, String(user.id)); } catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const membershipRows = data.memberships;
	const ownedIds = data.owned.map((row) => String(row.id ?? "").trim()).filter(Boolean);
	const accessibleIds = Array.from(new Set([
		...membershipRows.map((row) => String(row.workspaceId ?? "").trim()).filter(Boolean),
		...ownedIds,
	]));
	const defaultWorkspaceId = String(data.profile?.defaultWorkspaceId ?? "").trim() || null;
	if (!accessibleIds.length) return c.json({ ...emptyTeams, currentUserId: user.id, personalTeamId: defaultWorkspaceId }, 200, PRIVATE_NO_STORE_HEADERS);
	const teams = data.teams.map((row) => ({ id: String(row.id), name: String(row.name), publisherHandle: String(row.publisherHandle ?? "").trim() || null })).filter((row) => row.id && row.name);
	const membersByTeam: Record<string, unknown[]> = {};
	for (const row of data.members) {
		const workspaceId = String(row.workspaceId); if (!workspaceId) continue;
		(membersByTeam[workspaceId] ||= []).push({ workspace_id: workspaceId, user_id: row.userId, role: row.role, display_name: row.displayName ?? null });
	}
	const group = (rows: Array<Record<string, unknown>>) => {
		const grouped: Record<string, unknown[]> = {};
		for (const row of rows) {
			const id = typeof row.workspace_id === "string" ? row.workspace_id : null;
			if (id) (grouped[id] ||= []).push(row);
		}
		return grouped;
	};
	const preferred = c.req.query("preferredWorkspaceId")?.trim();
	const active = c.req.query("workspaceId")?.trim();
	const initialTeamId = [preferred, active, defaultWorkspaceId, teams[0]?.id].find((id) => Boolean(id && accessibleIds.includes(id))) ?? null;
	const manageable = new Set(ownedIds);
	for (const row of membershipRows) if (row.workspaceId && ["owner", "admin"].includes(String(row.role ?? "").toLowerCase())) manageable.add(String(row.workspaceId));
	const walletBalances: Record<string, number> = {};
	for (const row of data.balances) if (row.workspaceId) walletBalances[String(row.workspaceId)] = Number((Number(row.balanceNanos ?? 0) / 1_000_000_000).toFixed(2));
	const teamSsoSettingsByTeam: Record<string, unknown> = {};
	for (const row of data.settings) if (row.workspaceId) teamSsoSettingsByTeam[String(row.workspaceId)] = { sso_enabled: Boolean(row.ssoEnabled), sso_enforced: Boolean(row.ssoEnforced), sso_mode: String(row.ssoMode ?? "none"), sso_provider_identifier: row.ssoProviderIdentifier ?? null, sso_domains: Array.isArray(row.ssoDomains) ? row.ssoDomains : [] };
	const inviteRows = data.invites.map(({ invite, creatorDisplayName }) => ({ ...invite, workspace_id: invite.workspaceId, creator_user_id: invite.creatorUserId, expires_at: invite.expiresAt, max_uses: invite.maxUses, uses_count: invite.usesCount, token_preview: invite.tokenPreview, users: { display_name: creatorDisplayName } }));
	return c.json({
		teams,
		membersByTeam,
		invitesByTeam: group(inviteRows as unknown as Array<Record<string, unknown>>),
		requestsByTeam: group(data.requests as Array<Record<string, unknown>>),
		initialTeamId,
		currentUserId: user.id,
		personalTeamId: defaultWorkspaceId,
		manageableTeamIds: Array.from(manageable),
		walletBalances,
		teamSsoSettingsByTeam,
	}, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsTeamsRouter.post("/teams", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: { name?: string } = await c.req.json<{ name?: string }>().catch(() => ({}));
	const name = String(body.name ?? "").trim();
	if (!name) return c.json({ error: "invalid_name" }, 400, PRIVATE_NO_STORE_HEADERS);
	if (!await canCreateWorkspace(c.env, String(user.id))) return c.json({ error: "paid_workspace_required" }, 403, PRIVATE_NO_STORE_HEADERS);
	const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 42) || "workspace";
	const slug = `${slugBase}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`.slice(0, 50);
	let workspaceId; try { workspaceId = await createWorkspace(c.env, { userId: String(user.id), name, slug }); } catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	c.executionCtx.waitUntil(upsertLinearCustomer(c.env, { workspaceId, name }).catch((error) => console.error("[web-api/teams] Linear upsert failed", error)));
	return c.json({ id: workspaceId }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsTeamsRouter.get("/teams/:workspaceId/sso", async (c) => {
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: c.req.param("workspaceId") });
	if (!context || !["owner", "admin"].includes(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try { const row = await getWorkspaceSso(c.env, context.workspaceId); return c.json({ sso_enabled: Boolean(row?.ssoEnabled), sso_enforced: Boolean(row?.ssoEnforced), sso_mode: String(row?.ssoMode ?? "none"), sso_provider_identifier: row?.ssoProviderIdentifier ?? null, sso_domains: Array.isArray(row?.ssoDomains) ? row.ssoDomains : [] }, 200, PRIVATE_NO_STORE_HEADERS); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsTeamsRouter.put("/teams/:workspaceId", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: c.req.param("workspaceId") });
	if (!context || !["owner", "admin"].includes(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const body: { name?: string } = await c.req.json<{ name?: string }>().catch(() => ({}));
	const name = String(body.name ?? "").trim();
	if (!name) return c.json({ error: "invalid_name" }, 400, PRIVATE_NO_STORE_HEADERS);
	try { if (await renameWorkspace(c.env, context.workspaceId, String(user.id), name) === "personal") return c.json({ error: "personal_workspace" }, 409, PRIVATE_NO_STORE_HEADERS); return c.json({ id: context.workspaceId }, 200, PRIVATE_NO_STORE_HEADERS); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsTeamsRouter.delete("/teams/:workspaceId", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const workspaceId = c.req.param("workspaceId");
	let result; try { result = await removeWorkspace(c.env, workspaceId, String(user.id)); } catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	if (result === "personal") return c.json({ error: "personal_workspace" }, 409, PRIVATE_NO_STORE_HEADERS);
	if (result === "not_found") return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	if (result === "owner_required") return c.json({ error: "owner_required" }, 403, PRIVATE_NO_STORE_HEADERS);
	return c.json({ success: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsTeamsRouter.post("/teams/:workspaceId/invites", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: c.req.param("workspaceId") });
	if (!context || !["owner", "admin"].includes(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	const token = String(body.token ?? "");
	const role = ["admin", "member"].includes(String(body.role).toLowerCase()) ? String(body.role).toLowerCase() : "member";
	if (token.length < 6) return c.json({ error: "invalid_token" }, 400, PRIVATE_NO_STORE_HEADERS);
	try {
		const result = await createWorkspaceInvite(c.env, { workspaceId: context.workspaceId, creatorUserId: String(user.id), role: role as "admin" | "member", tokenEncrypted: await encryptInviteToken(c.env, token), tokenFingerprint: await inviteFingerprint(c.env, token), tokenPreview: token.length >= 4 ? `${token.slice(0, 2)}...${token.slice(-2)}` : token, expiresAt: new Date(Date.now() + Math.max(1, Number(body.expiresInDays) || 7) * 86_400_000).toISOString(), maxUses: typeof body.maxUses === "number" ? Math.max(0, Math.floor(body.maxUses)) : null, keyVersion: 1 });
		return c.json({ id: result?.id, token }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/teams] create invite failed", error);
		return c.json({ error: "invite_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountSettingsTeamsRouter.get("/teams/invites/:inviteId/reveal", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	let invite; try { invite = await findWorkspaceInvite(c.env, c.req.param("inviteId")); } catch { return c.json({ error: "invite_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	if (!invite) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	let role; try { role = await getMemberRole(c.env, String(invite.workspaceId), String(user.id)); } catch { return c.json({ error: "invite_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const creatorMember = String(invite.creatorUserId) === String(user.id) && Boolean(role);
	if (!creatorMember && !["owner", "admin"].includes(String(role ?? "").toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	if (!invite.tokenEncrypted) return c.json({ error: "token_unavailable" }, 409, PRIVATE_NO_STORE_HEADERS);
	try { return c.json({ id: invite.id, token: await decryptInviteToken(c.env, invite.tokenEncrypted) }, 200, PRIVATE_NO_STORE_HEADERS); }
	catch { return c.json({ error: "decrypt_failed" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsTeamsRouter.delete("/teams/invites/:inviteId", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	let invite; try { invite = await findWorkspaceInvite(c.env, c.req.param("inviteId")); } catch { return c.json({ error: "invite_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	if (!invite) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
	let role; try { role = await getMemberRole(c.env, String(invite.workspaceId), String(user.id)); } catch { return c.json({ error: "invite_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	const creatorMember = String(invite.creatorUserId) === String(user.id) && Boolean(role);
	if (!creatorMember && !["owner", "admin"].includes(String(role ?? "").toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	try { const result = await deleteWorkspaceInvite(c.env, String(invite.id)); return c.json({ success: true, id: result?.id }, 200, PRIVATE_NO_STORE_HEADERS); }
	catch { return c.json({ error: "invite_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsTeamsRouter.post("/teams/invites/accept", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ success: false, error: "Please sign in" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: { token?: string } = await c.req.json<{ token?: string }>().catch(() => ({}));
	const token = String(body.token ?? "");
	if (token.length < 6) return c.json({ success: false, error: "Invite code too short" }, 400, PRIVATE_NO_STORE_HEADERS);
	try {
		const result = await acceptWorkspaceInvite(c.env, { fingerprint: await inviteFingerprint(c.env, token), userId: String(user.id) });
		if (result.status === "invalid") return c.json({ success: false, error: "Invalid or expired invite" }, 404, PRIVATE_NO_STORE_HEADERS);
		if (result.status === "member") return c.json({ success: false, error: "You are already a member of this workspace" }, 409, PRIVATE_NO_STORE_HEADERS);
		if (result.status === "pending") return c.json({ success: false, error: "You already have a pending request" }, 409, PRIVATE_NO_STORE_HEADERS);
		return c.json({ success: true, requestId: result.id }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/teams] accept invite failed", error);
		return c.json({ success: false, error: "Could not create join request" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountSettingsTeamsRouter.put("/teams/:workspaceId/sso", async (c) => {
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: c.req.param("workspaceId") });
	if (!context || !["owner", "admin"].includes(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	const normalized = normalizeWorkspaceSsoUpdate(body);
	if ("error" in normalized) return c.json({ error: normalized.error }, 400, PRIVATE_NO_STORE_HEADERS);
	const payload = { workspace_id: context.workspaceId, ...normalized.value, updated_at: new Date().toISOString() };
	try { await saveWorkspaceSso(c.env, context.workspaceId, { ssoEnabled: normalized.value.sso_enabled, ssoEnforced: normalized.value.sso_enforced, ssoMode: normalized.value.sso_mode, ssoProviderIdentifier: normalized.value.sso_provider_identifier, ssoDomains: normalized.value.sso_domains, updatedAt: payload.updated_at }); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	return c.json({ success: true, workspaceId: context.workspaceId, settings: payload }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountSettingsTeamsRouter.put("/teams/:workspaceId/members/:userId", async (c) => {
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: c.req.param("workspaceId") });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	if (!["owner", "admin"].includes(context.role.toLowerCase())) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const targetUserId = c.req.param("userId");
	const body: { role?: string } = await c.req.json<{ role?: string }>().catch(() => ({}));
	const role = String(body.role ?? "").toLowerCase();
	if (!["admin", "member"].includes(role)) return c.json({ error: "invalid_role" }, 400, PRIVATE_NO_STORE_HEADERS);
	try { if (await setWorkspaceMemberRole(c.env, { workspaceId: context.workspaceId, userId: targetUserId, role: role as "admin" | "member" }) === "owner") return c.json({ error: "owner_role_fixed" }, 409, PRIVATE_NO_STORE_HEADERS); return c.json({ workspaceId: context.workspaceId, userId: targetUserId, role, ok: true }, 200, PRIVATE_NO_STORE_HEADERS); }
	catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsTeamsRouter.delete("/teams/:workspaceId/members/:userId", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const workspaceId = c.req.param("workspaceId");
	const targetUserId = c.req.param("userId");
	const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId });
	if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
	const isSelf = user.id === targetUserId;
	if (!isSelf && !["owner", "admin"].includes(context.role.toLowerCase())) return c.json({ workspaceId, userId: targetUserId, ok: false, message: "You don't have permission to remove this member from the workspace." }, 403, PRIVATE_NO_STORE_HEADERS);
	let removed; try { removed = await removeWorkspaceMember(c.env, { workspaceId, userId: targetUserId, actorRole: context.role, isSelf }); } catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
	if (removed.status === "owner") return c.json({ workspaceId, userId: targetUserId, ok: false, message: "You can't remove the workspace owner." }, 409, PRIVATE_NO_STORE_HEADERS);
	if (removed.status === "higher") return c.json({ workspaceId, userId: targetUserId, ok: false, message: "You can't remove a member with a higher role." }, 403, PRIVATE_NO_STORE_HEADERS);
	return c.json({ workspaceId, userId: targetUserId, ok: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

for (const decision of ["approve", "reject"] as const) {
	accountSettingsTeamsRouter.post(`/teams/join-requests/:requestId/${decision}`, async (c) => {
		const user = await requireUser(c.req.raw, c.env);
		if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
		let row; try { row = await decideWorkspaceJoinRequest(c.env, { requestId: c.req.param("requestId"), actorUserId: String(user.id), decision }); }
		catch { return c.json({ error: "settings_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
		if (!row?.id) return c.json({ error: "not_found" }, 404, PRIVATE_NO_STORE_HEADERS);
		return c.json({ success: true, id: row.id, workspaceId: row.workspaceId }, 200, PRIVATE_NO_STORE_HEADERS);
	});
}
