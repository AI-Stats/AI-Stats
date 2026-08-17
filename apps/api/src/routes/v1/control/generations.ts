// Purpose: Route handler module.
// Why: Keeps HTTP wiring separate from pipeline logic.
// How: Maps requests to pipeline entrypoints and responses.

import { Hono } from "hono";
import type { Env } from "@/runtime/types";
import { authenticate } from "@pipeline/before/auth";
import type { AuthFailure, AuthSuccess } from "@pipeline/before/auth";
import { findGeneration, findGenerationIoLog } from "@/repositories/generations";
import { readGatewayIoLogObject } from "@pipeline/audit/io-logging";
import { isGatewayIoLoggingFeatureEnabled } from "@core/feature-flags";
import { CAPABILITIES } from "@/lib/authz/capabilities";
import { json, withRuntime } from "../../utils";
import { requireCapability } from "./route-helpers";

function canReadGenerationIoLog(auth: AuthSuccess): boolean {
	if (auth.internal) return true;
	const scopes = new Set([...(auth.scopes ?? []), ...(auth.oauthScopes ?? [])]);
	return scopes.has(CAPABILITIES.GENERATIONS_READ);
}

function resolveReplayRequest(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const entries = Object.entries(value as Record<string, unknown>).filter(
        ([, entry]) => entry !== undefined,
    );
    if (entries.length === 0) return null;
    return Object.fromEntries(entries);
}

async function handleGeneration(req: Request) {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
        return json({ ok: false, error: "missing_id" }, 400, { "Cache-Control": "no-store" });
    }

    const auth = await authenticate(req, { allowOAuthJwt: true });
    if (!auth.ok) {
        const reason = (auth as AuthFailure).reason;
        return json({ ok: false, error: "unauthorised", reason }, 401, { "Cache-Control": "no-store" });
    }
	if (auth.authMethod === "oauth") {
		const scopeError = requireCapability(auth, CAPABILITIES.GENERATIONS_READ);
		if (scopeError) return scopeError;
	}

    let data;
    try { data = await findGeneration(auth.workspaceId, id); }
    catch (error) { return json({ ok: false, error: "db_error", message: error instanceof Error ? error.message : String(error) }, 500, { "Cache-Control": "no-store" }); }

    if (!data) {
        return json({ ok: false, error: "not_found" }, 404, { "Cache-Control": "no-store" });
    }

	const ioLoggingFeatureEnabled = canReadGenerationIoLog(auth) && await isGatewayIoLoggingFeatureEnabled({
		workspaceId: auth.workspaceId,
		apiKeyId: auth.apiKeyId,
		apiKeyRef: auth.apiKeyRef,
		apiKeyKid: auth.apiKeyKid,
		userId: auth.userId,
		internal: auth.internal,
	});
	let ioLogData = null;
	try { ioLogData = ioLoggingFeatureEnabled ? await findGenerationIoLog(auth.workspaceId, id) : null; }
	catch (error) { return json({ ok: false, error: "db_error", message: error instanceof Error ? error.message : String(error) }, 500, { "Cache-Control": "no-store" }); }

    const ioLog = ioLogData as Record<string, any> | null;
    let ioLogPayload: Record<string, unknown> | null = null;
    if (ioLog?.io_log_status === "stored" && typeof ioLog.io_log_object_key === "string") {
        try {
            ioLogPayload = await readGatewayIoLogObject(ioLog.io_log_object_key);
        } catch {
            ioLogPayload = null;
        }
    }
    const replayRequest = resolveReplayRequest(ioLogPayload?.request_payload);

    return json(
        {
            ...data,
            replay_supported: Boolean(replayRequest),
            replay_request: replayRequest,
			io_log: ioLog ? {
				status: ioLog.io_log_status ?? "not_enabled",
				storage_provider: ioLog.io_log_storage_provider ?? null,
				bucket: ioLog.io_log_bucket ?? null,
				object_key: ioLog.io_log_object_key ?? null,
				bytes: ioLog.io_log_bytes ?? null,
				sha256: ioLog.io_log_sha256 ?? null,
				content_type: ioLog.io_log_content_type ?? null,
				retention_until: ioLog.io_log_retention_until ?? null,
				error: ioLog.io_log_error ?? null,
				payload: ioLogPayload,
			} : null,
        },
        200,
        { "Cache-Control": "no-store" },
    );
}

export const generationsRoutes = new Hono<Env>();

generationsRoutes.get("/", withRuntime(handleGeneration));
