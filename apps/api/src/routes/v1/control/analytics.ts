// src/routes/v1/control/analytics.ts
// Purpose: Control-plane route handler for analytics operations.
// Why: Separates admin/control traffic from data-plane requests.
// How: Wires HTTP routes to pipeline entrypoints and response helpers.

import { Hono } from "hono";
import type { Env } from "@/runtime/types";
import { withRuntime, json } from "../../utils";
import { getSupabaseAdmin } from "@/runtime/env";
import { guardAuth, type GuardErr } from "@/pipeline/before/guards";
import { CAPABILITIES } from "@/lib/authz/capabilities";
import { requireCapability } from "./route-helpers";

const COMPLETED_DAYS_WINDOW = 30;
const ANALYTICS_FACT_PAGE_SIZE = 1000;
const ANALYTICS_FACT_MAX_ROWS = 10_000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function toNonEmptyString(value: unknown, fallback = "unknown"): string {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : fallback;
}

function parseDateParam(rawDate: string | null, todayStartUtc: Date): { ok: true; start: Date; end: Date } | { ok: false; response: Response } {
    const windowStart = new Date(todayStartUtc.getTime() - COMPLETED_DAYS_WINDOW * MS_PER_DAY);

    if (!rawDate) {
        return { ok: true, start: windowStart, end: todayStartUtc };
    }

    const value = rawDate.trim();
    if (!DATE_RE.test(value)) {
        return {
            ok: false,
            response: json(
                {
                    ok: false,
                    error: "invalid_request",
                    message: "date must use YYYY-MM-DD format",
                },
                400,
                { "Cache-Control": "no-store" }
            ),
        };
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        return {
            ok: false,
            response: json(
                {
                    ok: false,
                    error: "invalid_request",
                    message: "date must be a valid UTC date in YYYY-MM-DD format",
                },
                400,
                { "Cache-Control": "no-store" }
            ),
        };
    }

    if (parsed < windowStart || parsed >= todayStartUtc) {
        return {
            ok: false,
            response: json(
                {
                    ok: false,
                    error: "invalid_request",
                    message: "date must be within the last 30 completed UTC days",
                },
                400,
                { "Cache-Control": "no-store" }
            ),
        };
    }

    return { ok: true, start: parsed, end: new Date(parsed.getTime() + MS_PER_DAY) };
}

function resolveScopedTeamId(args: {
    authTeamId: string;
    requestedTeamId: string | null;
    internal?: boolean;
}): { ok: true; workspaceId: string } | { ok: false; response: Response } {
    const requested = args.requestedTeamId?.trim();
    if (!requested) {
        return { ok: true, workspaceId: args.authTeamId };
    }
    if (!args.internal && requested !== args.authTeamId) {
        return {
            ok: false,
            response: json(
                {
                    ok: false,
                    error: "forbidden",
                    message: "workspace_id must match authenticated team",
                },
                403,
                { "Cache-Control": "no-store" }
            ),
        };
    }
    return { ok: true, workspaceId: requested };
}

type AnalyticsFactRow = {
    occurred_at: string | null;
    endpoint: string | null;
    requested_model_slug: string | null;
    routed_model_slug: string | null;
    provider_model_id: string | null;
    cost_nanos: number | string | null;
    byok: boolean | null;
    v2_request_usage: Array<{
        meter_key: string | null;
        quantity: number | string | null;
    }> | null;
};

class AnalyticsFactLimitError extends Error {}

function toModelDisplay(permaslug: string): string {
    const match = permaslug.match(/^(.*)-\d{4}-\d{2}-\d{2}$/);
    if (match && match[1]) return match[1];
    return permaslug;
}

function toDayBucket(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return DATE_RE.test(trimmed) ? trimmed : null;
}

function toProviderName(providerId: string): string {
    const normalized = providerId.trim().toLowerCase();
    const exactMap: Record<string, string> = {
        openai: "OpenAI",
        anthropic: "Anthropic",
        "spacex-ai": "SpaceXAI",
        "google-ai-studio": "Google AI Studio",
        "google-vertex": "Google Vertex",
    };
    if (exactMap[normalized]) return exactMap[normalized];
    return providerId
        .split(/[-_]+/g)
        .filter((part) => part.length > 0)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function toUsdFromNanos(value: number | null): number {
    const nanos = value == null ? 0 : Math.max(0, value);
    return nanos / 1_000_000_000;
}

function toRoundedUsage(value: number): number {
    return Number(value.toFixed(9));
}

async function loadAnalyticsFactRows(args: {
    workspaceId: string;
    startIso: string;
    endIso: string;
}): Promise<AnalyticsFactRow[]> {
    const supabase = getSupabaseAdmin();
    const rows: AnalyticsFactRow[] = [];
    for (let offset = 0; offset < ANALYTICS_FACT_MAX_ROWS; offset += ANALYTICS_FACT_PAGE_SIZE) {
        const isFinalAllowedPage = offset + ANALYTICS_FACT_PAGE_SIZE >= ANALYTICS_FACT_MAX_ROWS;
        const { data, error } = await supabase
            .from("v2_request_facts")
            .select(
                "occurred_at,endpoint,requested_model_slug,routed_model_slug,provider_model_id,cost_nanos,byok,v2_request_usage(meter_key,quantity)"
            )
            .eq("workspace_id", args.workspaceId)
            .gte("occurred_at", args.startIso)
            .lt("occurred_at", args.endIso)
            .order("occurred_at", { ascending: true })
            .range(
                offset,
                isFinalAllowedPage ? ANALYTICS_FACT_MAX_ROWS : offset + ANALYTICS_FACT_PAGE_SIZE - 1
            );
        if (error) {
            throw new Error(error.message || "Failed to load v2 analytics request facts");
        }
        const page = (data ?? []) as AnalyticsFactRow[];
        if (isFinalAllowedPage && page.length > ANALYTICS_FACT_PAGE_SIZE) {
            throw new AnalyticsFactLimitError(
                "Analytics range contains too many requests; select a single date"
            );
        }
        rows.push(...page.slice(0, ANALYTICS_FACT_PAGE_SIZE));
        if (page.length < ANALYTICS_FACT_PAGE_SIZE) break;
    }
    return rows;
}

async function loadProviderNames(providerModelIds: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    if (providerModelIds.length === 0) return names;
    const supabase = getSupabaseAdmin();
    for (let offset = 0; offset < providerModelIds.length; offset += 200) {
        const { data, error } = await supabase
            .from("v2_model_provider_routes")
            .select("provider_model_id,provider_slug")
            .in("provider_model_id", providerModelIds.slice(offset, offset + 200));
        if (error) throw new Error(error.message || "Failed to load analytics provider names");
        for (const row of data ?? []) {
            if (row.provider_model_id && row.provider_slug) names.set(row.provider_model_id, row.provider_slug);
        }
    }
    return names;
}

function meterQuantity(row: AnalyticsFactRow, keys: string[]): number {
    const wanted = new Set(keys);
    return (row.v2_request_usage ?? []).reduce((total, meter) => {
        return wanted.has(meter.meter_key ?? "") ? total + (toFiniteNumber(meter.quantity) ?? 0) : total;
    }, 0);
}

async function handleAnalytics(req: Request) {
	const auth = await guardAuth(req, { allowOAuthJwt: true });
	if (!auth.ok) {
		return (auth as GuardErr).response;
	}
	const scopeError = requireCapability(auth.value, CAPABILITIES.ANALYTICS_READ);
	if (scopeError) return scopeError;
    const authValue = auth.value;
    const url = new URL(req.url);
    const teamScope = resolveScopedTeamId({
        authTeamId: authValue.workspaceId,
        requestedTeamId: url.searchParams.get("workspace_id"),
        internal: authValue.internal,
    });
    if (teamScope.ok === false) return teamScope.response;
    const workspaceId = teamScope.workspaceId;
    const todayStart = startOfUtcDay(new Date());
    const range = parseDateParam(url.searchParams.get("date"), todayStart);
    if (range.ok === false) return range.response;
    const startIso = range.start.toISOString();
	const endIso = range.end.toISOString();

	try {
		const rows = await loadAnalyticsFactRows({
			workspaceId,
			startIso,
            endIso,
        });
		const providerModelIds = Array.from(new Set(rows
			.map((row) => row.provider_model_id)
			.filter((value): value is string => Boolean(value))));
		const providerNames = await loadProviderNames(providerModelIds);
		const grouped = new Map<string, {
			date: string;
			model: string;
			model_permaslug: string;
			endpoint_id: string;
			provider_name: string;
			usage: number;
			byok_usage_inference: number;
			requests: number;
			prompt_tokens: number;
			completion_tokens: number;
			reasoning_tokens: number;
		}>();
		for (const row of rows) {
			const date = toDayBucket(row.occurred_at?.slice(0, 10));
			if (!date) continue;
			const modelPermaslug = toNonEmptyString(row.routed_model_slug ?? row.requested_model_slug, "unknown/unknown");
			const providerModelId = toNonEmptyString(row.provider_model_id, "unknown");
			const providerId = providerNames.get(providerModelId) ?? providerModelId.split(":", 1)[0] ?? "unknown";
			const endpointId = toNonEmptyString(row.endpoint, "unknown");
			const key = `${date}\u0000${modelPermaslug}\u0000${providerModelId}\u0000${endpointId}`;
			const existing = grouped.get(key) ?? {
				date,
				model: toModelDisplay(modelPermaslug),
				model_permaslug: modelPermaslug,
				endpoint_id: endpointId,
				provider_name: toProviderName(providerId),
				usage: 0,
				byok_usage_inference: 0,
				requests: 0,
				prompt_tokens: 0,
				completion_tokens: 0,
				reasoning_tokens: 0,
			};
			const usage = toUsdFromNanos(toFiniteNumber(row.cost_nanos));
			existing.usage += usage;
			if (row.byok) existing.byok_usage_inference += usage;
			existing.requests += 1;
			existing.prompt_tokens += Math.max(0, Math.round(meterQuantity(row, ["input_tokens", "prompt_tokens"])));
			existing.completion_tokens += Math.max(0, Math.round(meterQuantity(row, ["output_tokens", "completion_tokens"])));
			existing.reasoning_tokens += Math.max(0, Math.round(meterQuantity(row, ["reasoning_tokens"])));
			grouped.set(key, existing);
		}

        const data = Array.from(grouped.values())
			.map((item) => ({
				...item,
				usage: toRoundedUsage(item.usage),
				byok_usage_inference: toRoundedUsage(item.byok_usage_inference),
			}))
            .sort((a, b) => {
                if (a.date !== b.date) return b.date.localeCompare(a.date);
                if (a.usage !== b.usage) return b.usage - a.usage;
                if (a.requests !== b.requests) return b.requests - a.requests;
                return a.model_permaslug.localeCompare(b.model_permaslug);
            });

        return json(
            { data },
            200,
            { "Cache-Control": "no-store" }
        );
    } catch (error: any) {
        const factLimitExceeded = error instanceof AnalyticsFactLimitError;
        return json(
            {
                ok: false,
                error: factLimitExceeded ? "analytics_range_too_large" : "failed",
                message: String(error?.message ?? error),
            },
            factLimitExceeded ? 413 : 500,
            { "Cache-Control": "no-store" }
        );
    }
}

export const analyticsRoutes = new Hono<Env>();

analyticsRoutes.get("/", withRuntime(handleAnalytics));









