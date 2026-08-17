import { Hono } from "hono";
import { requireUser } from "@/auth/requireUser";
import type { Env } from "@/env";
import { PRIVATE_NO_STORE_HEADERS } from "@/http/cache";
import { buildGameProfileSummary, type GameResultRow } from "@/games/profile";
import { getProfileModelNames, getProfileRecord, hasBetterAuthBackupCodes, hasPublicPreset, listProfileGameResults, listProfileUsageRows, listProfileWorkspaceIds, saveProfileRecord } from "@/repositories/account-profile";
import { requireAccountWorkspace } from "./context";

type DailyActivityPoint = { date: string; requests: number; tokens: number; spendNanos: number };
type HeatmapDay = DailyActivityPoint & { monthLabel: string | null; weekdayLabel: string | null; inTrailingWindow: boolean; isFuture: boolean };
type UsageAggregateRow = {
	bucket: string | null;
	model_id: string | null;
	requests: number | string | null;
	tokens: number | string | null;
	cost: number | string | null;
};

const PROFILE_USAGE_WINDOW_DAYS = 365;
const PROFILE_USAGE_MAX_WORKSPACES = 100;

function dateKey(value: Date | string): string {
	const date = typeof value === "string" ? new Date(value) : value;
	return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, "0")}-${`${date.getUTCDate()}`.padStart(2, "0")}`;
}

function shiftDays(value: Date, days: number): Date {
	const next = new Date(value);
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}

function dailySeries(totals: Map<string, Omit<DailyActivityPoint, "date">>, days: number, now = new Date()): DailyActivityPoint[] {
	const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	return Array.from({ length: days }, (_, index) => {
		const date = shiftDays(today, index - days + 1);
		return { date: dateKey(date), ...(totals.get(dateKey(date)) ?? { requests: 0, tokens: 0, spendNanos: 0 }) };
	});
}

function heatmap(totals: Map<string, Omit<DailyActivityPoint, "date">>, now = new Date()): HeatmapDay[] {
	const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	const todayKey = dateKey(today);
	const trailingStartKey = dateKey(shiftDays(today, -364));
	const gridEnd = shiftDays(today, (7 - today.getUTCDay()) % 7);
	const gridStart = shiftDays(gridEnd, -(53 * 7) + 1);
	const days: HeatmapDay[] = [];
	let previousMonth = "";
	for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = shiftDays(cursor, 1)) {
		const key = dateKey(cursor);
		const month = cursor.toLocaleString("en", { month: "short", timeZone: "UTC" });
		const monthLabel = cursor.getUTCDate() <= 7 && month !== previousMonth ? month : null;
		days.push({
			date: key,
			...(totals.get(key) ?? { requests: 0, tokens: 0, spendNanos: 0 }),
			monthLabel,
			weekdayLabel: cursor.getUTCDay() >= 1 && cursor.getUTCDay() <= 5 ? ["", "M", "T", "W", "T", "F"][cursor.getUTCDay()] ?? null : "S",
			inTrailingWindow: key >= trailingStartKey && key <= todayKey,
			isFuture: key > todayKey,
		});
		previousMonth = month;
	}
	return days;
}

function periodChange(current: number, previous: number): number | null {
	if (current === 0 && previous === 0) return null;
	return previous === 0 ? 100 : ((current - previous) / previous) * 100;
}

function streaks(points: Array<{ requests: number }>) {
	let current = 0;
	let longest = 0;
	let running = 0;
	let activeDays = 0;
	for (const point of points) {
		running = point.requests > 0 ? running + 1 : 0;
		if (point.requests > 0) activeDays += 1;
		longest = Math.max(longest, running);
	}
	for (let index = points.length - 1; index >= 0 && points[index]?.requests; index -= 1) current += 1;
	return { current, longest, activeDays };
}

function profileSlug(displayName: string, userId: string): string {
	const base = displayName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "profile";
	return `${base.slice(0, 40)}-${userId.replace(/-/g, "").slice(0, 8).toLowerCase()}`;
}

function normalizePublicProfileSlug(value: unknown): string {
	return String(value ?? "").trim().toLowerCase().replace(/^@+/, "").replace(/[^a-z0-9._-]+/g, "-").replace(/-{2,}/g, "-").replace(/^[-._]+|[-._]+$/g, "");
}

async function callBetterAuth(request: Request, env: Env, path: string, body: Record<string, unknown>) {
	const base = env.BETTER_AUTH_URL?.trim();
	if (!base) throw new Error("BETTER_AUTH_URL is required");
	const url = new URL(base); url.pathname = `${url.pathname.replace(/\/+$/, "")}/api/auth${path}`; url.search = ""; url.hash = "";
	return fetch(url, { method: "POST", headers: { "content-type": "application/json", ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie")! } : {}), ...(request.headers.get("authorization") ? { authorization: request.headers.get("authorization")! } : {}) }, body: JSON.stringify(body), redirect: "error" });
}

function emptyProfileUsage(workspaceCount = 0) {
	const totals = new Map<string, Omit<DailyActivityPoint, "date">>();
	const series30 = dailySeries(totals, 30);
	return {
		requestSeries: series30,
		tokenSeries: series30,
		activitySeries30: series30,
		requestChange: null,
		tokenChange: null,
		totalRequests: 0,
		totalTokens: 0,
		avgPerDay: 0,
		avgPerWeek: 0,
		currentStreak: 0,
		longestStreak: 0,
		activeDays: 0,
		topModels: [],
		modelActivity: [],
		heatmapDays: heatmap(totals),
		creditsUsage: { today: "$0.0000", week: "$0.0000", month: "$0.0000" },
		byokUsage: { today: "$0.0000", week: "$0.0000", month: "$0.0000" },
		usageWorkspaceCount: workspaceCount,
	};
}

async function buildProfileUsage(
	env: Env,
	workspaceIds: string[],
) {
	if (!workspaceIds.length) return emptyProfileUsage();
	const rows = await listProfileUsageRows(env, workspaceIds, PROFILE_USAGE_WINDOW_DAYS) as UsageAggregateRow[];
	const totals = new Map<string, Omit<DailyActivityPoint, "date">>();
	const models = new Map<string, { requests: number; tokens: number; spendNanos: number }>();
	const modelActivity = new Map<string, { date: string; id: string; requests: number; tokens: number; spendNanos: number }>();
	let totalRequests = 0;
	let totalTokens = 0;

	for (const row of rows) {
		if (!row.bucket) continue;
		const key = dateKey(row.bucket);
		const requests = Number(row.requests) || 0;
		const tokens = Number(row.tokens) || 0;
		const spendNanos = Math.round((Number(row.cost) || 0) * 1_000_000_000);
		totalRequests += requests;
		totalTokens += tokens;
		const day = totals.get(key) ?? { requests: 0, tokens: 0, spendNanos: 0 };
		day.requests += requests;
		day.tokens += tokens;
		day.spendNanos += spendNanos;
		totals.set(key, day);
		const modelId = String(row.model_id ?? "").trim() || "unknown";
		const model = models.get(modelId) ?? { requests: 0, tokens: 0, spendNanos: 0 };
		model.requests += requests;
		model.tokens += tokens;
		model.spendNanos += spendNanos;
		models.set(modelId, model);
		const modelDayKey = `${key}:${modelId}`;
		const modelDay = modelActivity.get(modelDayKey) ?? {
			date: key,
			id: modelId,
			requests: 0,
			tokens: 0,
			spendNanos: 0,
		};
		modelDay.requests += requests;
		modelDay.tokens += tokens;
		modelDay.spendNanos += spendNanos;
		modelActivity.set(modelDayKey, modelDay);
	}

	const modelIds = [...models.keys()].filter((id) => id !== "unknown");
	const modelNames = new Map<string, string>();
	if (modelIds.length) {
		for (const [id, name] of await getProfileModelNames(env, modelIds)) modelNames.set(id, name);
	}

	const series30 = dailySeries(totals, 30);
	const series60 = dailySeries(totals, 60);
	const streak = streaks(series30);
	const usd = (nanos: number) => `$${(nanos / 1_000_000_000).toFixed(4)}`;
	return {
		requestSeries: series30,
		tokenSeries: series30,
		activitySeries30: series30,
		requestChange: periodChange(series60.slice(-30).reduce((sum, item) => sum + item.requests, 0), series60.slice(0, 30).reduce((sum, item) => sum + item.requests, 0)),
		tokenChange: periodChange(series60.slice(-30).reduce((sum, item) => sum + item.tokens, 0), series60.slice(0, 30).reduce((sum, item) => sum + item.tokens, 0)),
		totalRequests,
		totalTokens,
		avgPerDay: streak.activeDays ? totalRequests / streak.activeDays : 0,
		avgPerWeek: totalRequests / 52,
		currentStreak: streak.current,
		longestStreak: streak.longest,
		activeDays: streak.activeDays,
		topModels: [...models.entries()]
			.map(([id, value]) => ({ id, name: modelNames.get(id) ?? id, ...value }))
			.sort((left, right) => right.tokens - left.tokens || right.requests - left.requests || right.spendNanos - left.spendNanos),
		modelActivity: [...modelActivity.values()]
			.map((entry) => ({ ...entry, name: modelNames.get(entry.id) ?? entry.id }))
			.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id)),
		heatmapDays: heatmap(totals),
		creditsUsage: {
			today: usd(series30.slice(-1).reduce((sum, item) => sum + item.spendNanos, 0)),
			week: usd(series30.slice(-7).reduce((sum, item) => sum + item.spendNanos, 0)),
			month: usd(series30.reduce((sum, item) => sum + item.spendNanos, 0)),
		},
		byokUsage: { today: "$0.0000", week: "$0.0000", month: "$0.0000" },
		usageWorkspaceCount: workspaceIds.length,
	};
}

export const accountSettingsProfileRouter = new Hono<{ Bindings: Env }>();

accountSettingsProfileRouter.put("/account/profile", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
	try {
		const current = await getProfileRecord(c.env, user.id);
		const update: Parameters<typeof saveProfileRecord>[2] = {};
		if (body.display_name !== undefined) update.displayName = body.display_name == null ? null : String(body.display_name);
		if (body.default_workspace_id !== undefined) update.defaultWorkspaceId = body.default_workspace_id == null ? null : String(body.default_workspace_id);
		if (body.obfuscate_info !== undefined) update.obfuscateInfo = Boolean(body.obfuscate_info);
		if (body.public_profile_slug !== undefined) {
			const slug = normalizePublicProfileSlug(body.public_profile_slug);
			if (slug.length < 3 || slug.length > 40) return c.json({ error: "invalid_public_profile_slug" }, 400, PRIVATE_NO_STORE_HEADERS);
			const previous = normalizePublicProfileSlug(current?.profile.publicProfileSlug);
			if (previous && previous !== slug && await hasPublicPreset(c.env, user.id)) return c.json({ error: "public_profile_slug_in_use" }, 409, PRIVATE_NO_STORE_HEADERS);
			update.publicProfileSlug = slug;
		}
		if (body.public_profile_enabled !== undefined) {
			if (body.public_profile_enabled && !normalizePublicProfileSlug(update.publicProfileSlug ?? current?.profile.publicProfileSlug)) return c.json({ error: "public_profile_slug_required" }, 400, PRIVATE_NO_STORE_HEADERS);
			update.publicProfileEnabled = Boolean(body.public_profile_enabled);
		}
		if (update.defaultWorkspaceId) {
			const context = await requireAccountWorkspace({ request: c.req.raw, env: c.env, workspaceId: update.defaultWorkspaceId });
			if (!context) return c.json({ error: "forbidden" }, 403, PRIVATE_NO_STORE_HEADERS);
		}
		await saveProfileRecord(c.env, user.id, update);
		return c.json({ ok: true }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch (error) {
		if (String(error).includes("public_profile_slug")) return c.json({ error: "public_profile_slug_conflict" }, 409, PRIVATE_NO_STORE_HEADERS);
		return c.json({ error: "profile_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS);
	}
});

accountSettingsProfileRouter.post("/account/recovery-codes", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: { password?: string } = await c.req.json<{ password?: string }>().catch(() => ({}));
	try {
		const response = await callBetterAuth(c.req.raw, c.env, "/two-factor/generate-backup-codes", { ...(body.password ? { password: body.password } : {}) });
		const payload = await response.json() as { backupCodes?: string[]; message?: string };
		if (!response.ok || !Array.isArray(payload.backupCodes)) return c.json({ error: payload.message ?? "recovery_codes_unavailable" }, response.status === 401 ? 401 : 409, PRIVATE_NO_STORE_HEADERS);
		return c.json({ recoveryCodes: payload.backupCodes }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch { return c.json({ error: "recovery_codes_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsProfileRouter.get("/account/recovery-codes", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	try { const exists = await hasBetterAuthBackupCodes(c.env, user.id); return c.json({ hasRecoveryCodes: exists, unusedCount: exists ? 10 : 0 }, 200, PRIVATE_NO_STORE_HEADERS); }
	catch { return c.json({ error: "recovery_codes_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsProfileRouter.delete("/account/recovery-codes", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: { password?: string } = await c.req.json<{ password?: string }>().catch(() => ({}));
	try {
		const response = await callBetterAuth(c.req.raw, c.env, "/two-factor/generate-backup-codes", { ...(body.password ? { password: body.password } : {}) });
		if (!response.ok) return c.json({ error: "recovery_codes_unavailable" }, response.status === 401 ? 401 : 409, PRIVATE_NO_STORE_HEADERS);
		return c.json({ success: true }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch { return c.json({ error: "recovery_codes_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsProfileRouter.post("/account/recovery-codes/verify", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ error: "unauthorized" }, 401, PRIVATE_NO_STORE_HEADERS);
	const body: { code?: string } = await c.req.json<{ code?: string }>().catch(() => ({}));
	try {
		const response = await callBetterAuth(c.req.raw, c.env, "/two-factor/verify-backup-code", { code: String(body.code ?? ""), disableSession: false });
		if (!response.ok) return c.json({ error: "Invalid or already used recovery code" }, 409, PRIVATE_NO_STORE_HEADERS);
		return c.json({ success: true }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch { return c.json({ error: "recovery_codes_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsProfileRouter.get("/profile", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ obfuscateInfo: false, profile: null }, 200, PRIVATE_NO_STORE_HEADERS);
	try {
		const record = await getProfileRecord(c.env, user.id);
		const profileRow = record?.profile;
		const displayName = String(profileRow?.displayName ?? user.userMetadata.display_name ?? user.userMetadata.name ?? user.email?.split("@")[0] ?? "Phaseo User").trim() || "Phaseo User";
		const storedSlug = normalizePublicProfileSlug(profileRow?.publicProfileSlug) || null;
		const suggestedSlug = profileSlug(displayName, user.id);
		const profile = {
			userId: user.id, displayName, email: user.email, avatarUrl: typeof user.userMetadata.avatar_url === "string" ? user.userMetadata.avatar_url : null,
			memberSince: String(profileRow?.createdAt ?? user.createdAt), workspaceName: record?.workspaceName ?? "Personal",
			publicProfileEnabled: Boolean(profileRow?.publicProfileEnabled), publicProfileSlug: storedSlug,
			suggestedProfileSlug: suggestedSlug, shareUrl: storedSlug ? `https://phaseo.app/profile/${storedSlug}` : null, ...emptyProfileUsage(),
		};
		const override = c.req.query("obfuscateInfo");
		return c.json({ obfuscateInfo: override === "1" ? true : override === "0" ? false : Boolean(profileRow?.obfuscateInfo), profile }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch { return c.json({ error: "profile_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsProfileRouter.get("/profile/usage", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ usage: null }, 200, PRIVATE_NO_STORE_HEADERS);
	try {
		const workspaceIds = await listProfileWorkspaceIds(c.env, user.id, PROFILE_USAGE_MAX_WORKSPACES);
		return c.json({ usage: await buildProfileUsage(c.env, workspaceIds) }, 200, PRIVATE_NO_STORE_HEADERS);
	} catch { return c.json({ error: "profile_usage_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});

accountSettingsProfileRouter.get("/profile/games", async (c) => {
	const user = await requireUser(c.req.raw, c.env);
	if (!user) return c.json({ games: null }, 200, PRIVATE_NO_STORE_HEADERS);
	try { return c.json({ games: buildGameProfileSummary(await listProfileGameResults(c.env, user.id) as GameResultRow[]) }, 200, PRIVATE_NO_STORE_HEADERS); }
	catch { return c.json({ error: "profile_games_unavailable" }, 503, PRIVATE_NO_STORE_HEADERS); }
});
