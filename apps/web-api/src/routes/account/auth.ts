import { Hono } from "hono";
import { requireUser } from "@/auth/requireUser";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { normaliseCountryCode } from "@/lib/countryCodes";
import { getAccountProfile, getOAuthConsentContext, listAccountWorkspaces, listAllWorkspaces, setDefaultWorkspace, updateOnboardingProfile, validateOAuthConsentSelection } from "@/repositories/account-auth";
import { getWorkspaceAccess } from "@/repositories/workspace-access";

function cookieValue(request: Request, name: string): string | null {
	for (const segment of (request.headers.get("cookie") ?? "").split(";")) {
		const separator = segment.indexOf("=");
		if (separator < 0 || segment.slice(0, separator).trim() !== name) continue;
		const value = segment.slice(separator + 1).trim();
		try { return decodeURIComponent(value) || null; } catch { return value || null; }
	}
	return null;
}

function metadataString(metadata: Record<string, unknown>, keys: string[]): string | null {
	for (const key of keys) {
		const value = metadata[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return null;
}

function normalizeBetaFeatures(value: unknown): Record<string, boolean> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, boolean] =>
			typeof entry[1] === "boolean",
		),
	);
}

function isMissingCountryColumn(error: unknown) {
	const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
	const message = String(value.message ?? "").toLowerCase();
	return ["declared_country_code", "country_declared_at"].some((column) => message.includes(column));
}

export const accountAuthRouter = new Hono<{ Bindings: Env }>();

export function isGatewayApiKey(value: string): boolean {
	return /^(?:phaseo_v1|aistats(?:_v\d+)?)_sk_[A-Za-z0-9_-]{16,}$/.test(value);
}

accountAuthRouter.get("/status", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) {
		return c.json({ isAdmin: false, role: null, signedIn: false }, 200, PRIVATE_NO_STORE_HEADERS);
	}
	try {
		const data = await getAccountProfile(c.env, user.id);
		return c.json({ isAdmin: String(data?.role ?? "").toLowerCase() === "admin", role: data?.role ?? null, signedIn: true }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account/auth] status failed", { userId: user.id, error });
		return c.json({ error: "auth_status_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountAuthRouter.get("/onboarding", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ signedIn: false, user: null, workspaces: [] }, 200, PRIVATE_NO_STORE_HEADERS);
	try {
		const [profile, workspaces] = await Promise.all([getAccountProfile(c.env, user.id), listAccountWorkspaces(c.env, user.id)]);
		return c.json({ signedIn: true, user: profile ? { onboarding_state: profile.onboardingState, onboarding_completed_at: profile.onboardingCompletedAt, default_workspace_id: profile.defaultWorkspaceId, declared_country_code: profile.declaredCountryCode, country_declared_at: profile.countryDeclaredAt } : null, workspaces: workspaces.filter((workspace) => ["owner", "admin"].includes(String(workspace.role))), countryStorageAvailable: true }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch { return c.json({ error: "onboarding_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountAuthRouter.get("/workspace", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ signedIn: false, workspaceId: null }, 200, PRIVATE_NO_STORE_HEADERS);
	try {
		const requested = String(c.req.query("requested") ?? "").trim();
		const requestedRoles = String(c.req.query("roles") ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
		const [profile, memberships] = await Promise.all([getAccountProfile(c.env, user.id), listAccountWorkspaces(c.env, user.id)]);
		const roleAllowed = (role: string) => requestedRoles.length === 0 || requestedRoles.includes(role) || (role === "owner" && requestedRoles.includes("admin"));
		const accessible = memberships.filter((workspace) => roleAllowed(String(workspace.role))).map((workspace) => workspace.id);
		const defaultWorkspaceId = String(profile?.defaultWorkspaceId ?? "");
		const workspaceId = (requested && accessible.includes(requested) ? requested : null) ?? (defaultWorkspaceId && accessible.includes(defaultWorkspaceId) ? defaultWorkspaceId : null) ?? accessible.sort()[0] ?? null;
		if (workspaceId && workspaceId !== defaultWorkspaceId && c.req.query("persist") === "1") await setDefaultWorkspace(c.env, user.id, workspaceId);
		return c.json({ signedIn: true, userId: user.id, workspaceId }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch { return c.json({ error: "workspace_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountAuthRouter.get("/workspace-access", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ allowed: false, role: null, userId: null }, 401, PRIVATE_NO_STORE_HEADERS);
	const workspaceId = String(c.req.query("workspaceId") ?? "").trim();
	if (!workspaceId) return c.json({ allowed: false, role: null, userId: user.id }, 400, PRIVATE_NO_STORE_HEADERS);
	try {
		const access = await getWorkspaceAccess(c.env, user.id, workspaceId);
		const role = access?.role ?? null;
		const requestedRoles = String(c.req.query("roles") ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
		const allowed = Boolean(role) && (requestedRoles.length === 0 || requestedRoles.includes(role!) || (role === "owner" && requestedRoles.includes("admin")));
		return c.json({ allowed, role, userId: user.id }, allowed ? 200 : 403, PRIVATE_NO_STORE_HEADERS);
	} catch { return c.json({ error: "workspace_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountAuthRouter.get("/workspaces", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ workspaces: [] }, 401, PRIVATE_NO_STORE_HEADERS);
	try {
		const workspaces = (await listAccountWorkspaces(c.env, user.id)).map((workspace) => ({ id: workspace.id, name: workspace.name || workspace.slug || workspace.id, role: workspace.role }));
		return c.json({ workspaces }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch { return c.json({ error: "workspace_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountAuthRouter.post("/test-key", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ ok: false, message: "Sign in to test API keys." }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: { apiKey?: unknown } = await c.req.json().catch(() => ({}));
	const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
	if (!isGatewayApiKey(apiKey)) return c.json({ ok: false, message: "This does not look like a Phaseo API key." }, 400, PRIVATE_NO_STORE_HEADERS);
	const raw = c.env.NEXT_PUBLIC_GATEWAY_API_URL ?? c.env.NEXT_PUBLIC_API_URL ?? c.env.AI_STATS_GATEWAY_URL ?? "https://api.phaseo.app";
	const base = raw.replace(/\/+$/, ""); const gateway = base.endsWith("/v1") ? base : `${base}/v1`;
	try {
		const response = await fetch(`${gateway}/models?endpoints=chat/completions`, { headers: { Authorization: `Bearer ${apiKey}` } });
		const payload: any = await response.json().catch(() => null);
		if (!response.ok) { const message = typeof payload?.error?.message === "string" ? payload.error.message : typeof payload?.message === "string" ? payload.message : response.status === 401 ? "The gateway rejected this key." : "The gateway could not verify this key."; return c.json({ ok: false, status: response.status, message }, 400, PRIVATE_NO_STORE_HEADERS); }
		const modelCount = Array.isArray(payload?.data) ? payload.data.length : Array.isArray(payload) ? payload.length : null;
		return c.json({ ok: true, status: response.status, modelCount }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch { return c.json({ ok: false, message: "Could not reach the gateway to test this key." }, 502, PRIVATE_NO_STORE_HEADERS); }
});

accountAuthRouter.get("/oauth-consent", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const clientId = String(c.req.query("clientId") ?? "").trim();
	try { return c.json(await getOAuthConsentContext(c.env, user.id, clientId), 200, PRIVATE_NO_STORE_HEADERS); }
	catch { return c.json({ error: "oauth_consent_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountAuthRouter.post("/oauth-consent/validate", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "Unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: { clientId?: string; workspaceIds?: string[] } = await c.req.json<{ clientId?: string; workspaceIds?: string[] }>().catch(() => ({}));
	const clientId = String(body.clientId ?? "").trim();
	const workspaceIds = [...new Set((Array.isArray(body.workspaceIds) ? body.workspaceIds : []).map(String).map((value) => value.trim()).filter(Boolean))];
	if (!clientId || !workspaceIds.length) return c.json({ error: "Select at least one team to authorize" }, 400, PRIVATE_NO_STORE_HEADERS);
	const validation = await validateOAuthConsentSelection(c.env, user.id, clientId, workspaceIds);
	if (!validation.allowed) return c.json({ error: "You don't have permission to authorize for one or more selected teams" }, 403, PRIVATE_NO_STORE_HEADERS);
	if (!validation.appFound) return c.json({ error: "OAuth application not found or inactive" }, 404, PRIVATE_NO_STORE_HEADERS);
	return c.json({ valid: true }, 200, PRIVATE_NO_STORE_HEADERS);
});

accountAuthRouter.put("/onboarding", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	try {
		const existing = await getAccountProfile(c.env, user.id);
		const hasCountryInput = Object.prototype.hasOwnProperty.call(body, "countryCode");
		const countryCode = hasCountryInput ? normaliseCountryCode(body.countryCode) : null;
		if (hasCountryInput && !countryCode) return c.json({ error: "invalid_country_code" }, 400, PRIVATE_NO_STORE_HEADERS);
		const existingCountry = normaliseCountryCode(existing?.declaredCountryCode);
		if ((body.status === "completed" || body.status === "skipped") && !(countryCode ?? existingCountry)) return c.json({ error: "country_required" }, 400, PRIVATE_NO_STORE_HEADERS);
		const current = existing?.onboardingState && typeof existing.onboardingState === "object" && !Array.isArray(existing.onboardingState) ? existing.onboardingState as Record<string, unknown> : {};
		const next: Record<string, unknown> = { ...current, updatedAt: new Date().toISOString() };
		for (const key of ["workspaceId", "selectedModelId", "selectedKeyId", "createdKeyId", "keyPrefix"] as const) if (Object.prototype.hasOwnProperty.call(body, key)) next[key] = body[key];
		if (["started", "completed", "skipped"].includes(String(body.status))) next.status = body.status;
		if (Array.isArray(body.completedSteps)) next.completedSteps = Array.from(new Set([...(Array.isArray(current.completedSteps) ? current.completedSteps : []), ...body.completedSteps].map((value) => String(value ?? "").trim()).filter((value) => /^[a-z0-9_-]+$/i.test(value))));
		const now = new Date().toISOString();
		await updateOnboardingProfile(c.env, user.id, { onboardingState: next, ...((body.status === "completed" || body.status === "skipped") ? { onboardingCompletedAt: now } : {}), ...(countryCode ? { declaredCountryCode: countryCode, countryDeclaredAt: now } : {}) });
		return c.json({ state: next }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch { return c.json({ error: "onboarding_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountAuthRouter.get("/statsig", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ signedIn: false, profile: { betaOptIn: false, betaFeatures: {} } }, 200, PRIVATE_NO_STORE_HEADERS);
	try {
		const data = await getAccountProfile(c.env, user.id);
		const isAdmin = String(data?.role ?? "").toLowerCase() === "admin";
		const betaFeatures = normalizeBetaFeatures(data?.betaFeatures);
		if (isAdmin) betaFeatures.chat_realtime_voice = true; else delete betaFeatures.chat_realtime_voice;
		return c.json({ signedIn: true, user: { id: user.id, email: user.email }, profile: { betaOptIn: Boolean(data?.betaOptIn) || isAdmin, betaFeatures } }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account/auth] statsig failed", { userId: user.id, error });
		return c.json({ error: "auth_statsig_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountAuthRouter.get("/header", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ isLoggedIn: false, teams: [] }, 200, PRIVATE_NO_STORE_HEADERS);
	try {
		const [profile, accessible] = await Promise.all([getAccountProfile(c.env, user.id), listAccountWorkspaces(c.env, user.id)]);
		const role = String(profile?.role ?? "");
		const defaultWorkspaceId = String(profile?.defaultWorkspaceId ?? "");
		let teams = accessible.map((workspace) => ({ id: workspace.id, name: workspace.name }));
		if (!teams.length && ["admin", "editor"].includes(role.toLowerCase())) teams = await listAllWorkspaces(c.env);
		teams.sort((left, right) => left.id === defaultWorkspaceId ? -1 : right.id === defaultWorkspaceId ? 1 : left.name.localeCompare(right.name));
		const currentTeamId = cookieValue(c.req.raw, "activeWorkspaceId") ?? (defaultWorkspaceId || undefined);
		const displayName = String(profile?.displayName ?? "").trim() || metadataString(user.userMetadata, ["full_name", "name"]);
		return c.json({ isLoggedIn: true, user: { id: user.id, email: user.email, displayName, avatarUrl: metadataString(user.userMetadata, ["avatar_url", "picture", "picture_url"]) }, teams, ...(currentTeamId ? { currentTeamId } : {}), ...(role ? { userRole: role } : {}) }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		console.error("[web-api/account/auth] header failed", { userId: user.id, error });
		return c.json({ error: "auth_header_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});
