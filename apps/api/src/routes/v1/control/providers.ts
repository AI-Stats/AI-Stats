// Purpose: Route handler module.
// Why: Keeps HTTP wiring separate from pipeline logic.
// How: Maps requests to pipeline entrypoints and responses.

import { Hono } from "hono";
import type { Env } from "@/runtime/types";
import { listProviders } from "@/repositories/catalogue";
import { guardAuth, type GuardErr } from "@pipeline/before/guards";
import { CAPABILITIES } from "@/lib/authz/capabilities";
import { json, withRuntime, cacheHeaders, cacheResponse } from "@/routes/utils";
import { requireCapability } from "./route-helpers";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 250;

function parsePaginationParam(raw: string | null, fallback: number, max: number): number {
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    const normalized = Math.floor(parsed);
    if (normalized <= 0) return fallback;
    if (normalized > max) return max;
    return normalized;
}

function parseOffsetParam(raw: string | null): number {
    if (!raw) return 0;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
}

type Provider = {
    api_provider_id: string;
    api_provider_name: string | null;
    description: string | null;
    link: string | null;
    country_code: string | null;
};

function metadataString(metadata: unknown, key: string): string | null {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" ? value : null;
}

async function handleProviders(req: Request) {
    const auth = await guardAuth(req, { allowOAuthJwt: true });
    if (!auth.ok) {
        return (auth as GuardErr).response;
    }
    const scopeError = requireCapability(auth.value, CAPABILITIES.PROVIDERS_READ);
    if (scopeError) return scopeError;

    const url = new URL(req.url);
    const limit = parsePaginationParam(url.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const offset = parseOffsetParam(url.searchParams.get("offset"));

    try {
        const { total, rows } = await listProviders(limit, offset);
        const mapped: Provider[] = rows.map((provider) => ({
            api_provider_id: provider.apiProviderId,
            api_provider_name: provider.apiProviderName ?? null,
            description: metadataString(provider.metadata, "description"),
            link: metadataString(provider.metadata, "link"),
            country_code: provider.countryCode ?? null,
        }));

        const cacheOptions = {
            scope: `providers:${auth.value.workspaceId}`,
            ttlSeconds: 300,
            staleSeconds: 600,
        };
        const response = json(
            {
                ok: true,
                limit,
                offset,
                total,
                providers: mapped,
            },
            200,
            cacheHeaders(cacheOptions)
        );
        return cacheResponse(req, response, cacheOptions);
    } catch (error: any) {
        return json(
            { ok: false, error: "failed", message: String(error?.message ?? error) },
            500,
            { "Cache-Control": "no-store" }
        );
    }
}

export const providersRoutes = new Hono<Env>();

providersRoutes.get("/", withRuntime(handleProviders));
