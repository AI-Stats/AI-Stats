import { getBindings } from "@/runtime/env";
import { isGatewayIoLoggingFeatureEnabled } from "@/core/feature-flags";
import { findWorkspaceSettings } from "@/repositories/workspace-settings";
import { upsertGenerationIoLog } from "@/repositories/generations";

export type GatewayIoLogStatus = "not_enabled" | "stored" | "missing_bucket" | "too_large" | "error" | "deleted";

export type GatewayIoLogColumns = {
    io_log_status: GatewayIoLogStatus;
    io_log_storage_provider?: string | null;
    io_log_bucket?: string | null;
    io_log_object_key?: string | null;
    io_log_bytes?: number | null;
    io_log_sha256?: string | null;
    io_log_content_type?: string | null;
    io_log_retention_until?: string | null;
    io_log_error?: string | null;
};

type GatewayIoLogInput = {
    requestId: string;
    workspaceId: string;
    appId?: string | null;
    keyId?: string | null;
    endpoint?: string | null;
    modelId?: string | null;
    provider?: string | null;
    statusCode?: number | null;
    success: boolean;
    requestPayload?: unknown;
    gatewayResponse?: unknown;
    providerRequest?: unknown;
    providerResponse?: unknown;
    metadata?: unknown;
};

export type WorkspaceIoLoggingSettings = {
    enabled: boolean;
    retentionDays: number;
    includeProviderPayloads: boolean;
    billingStatus: "active" | "grace" | "suspended";
};

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_RETENTION_DAYS = 90;
const settingsCache = new Map<string, { value: WorkspaceIoLoggingSettings; expiresAt: number }>();

function normalizeRetentionDays(value: unknown): number {
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(numeric)) return DEFAULT_RETENTION_DAYS;
    return Math.max(DEFAULT_RETENTION_DAYS, Math.min(365, Math.trunc(numeric)));
}

function normalizeMaxBytes(value: unknown): number {
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_MAX_BYTES;
    return Math.max(64 * 1024, Math.min(100 * 1024 * 1024, Math.trunc(numeric)));
}

function sanitizeJsonValue(value: unknown): unknown {
    if (value === undefined) return null;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return null;
    }
}

function isoDatePath(date: Date): string {
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}/${month}/${day}`;
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date.getTime());
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const input = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const digest = await crypto.subtle.digest("SHA-256", input);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

export async function getWorkspaceIoLoggingSettings(workspaceId: string): Promise<WorkspaceIoLoggingSettings> {
    const now = Date.now();
    const cached = settingsCache.get(workspaceId);
    if (cached && cached.expiresAt > now) return cached.value;

    const disabled = {
        enabled: false,
        retentionDays: DEFAULT_RETENTION_DAYS,
        includeProviderPayloads: true,
        billingStatus: "active" as const,
    };

    try {
		const data = await findWorkspaceSettings(workspaceId);
		if (!data) {
            settingsCache.set(workspaceId, { value: disabled, expiresAt: now + 60_000 });
            return disabled;
        }

        const row = data;
		const billingStatus: WorkspaceIoLoggingSettings["billingStatus"] =
			row.ioLoggingBillingStatus === "grace" || row.ioLoggingBillingStatus === "suspended"
				? row.ioLoggingBillingStatus
                : "active";
        const value = {
			enabled: row.ioLoggingEnabled === true,
            retentionDays: billingStatus === "suspended"
                ? DEFAULT_RETENTION_DAYS
				: normalizeRetentionDays(row.ioLoggingRetentionDays),
			includeProviderPayloads: row.ioLoggingIncludeProviderPayloads !== false,
            billingStatus,
        };
        settingsCache.set(workspaceId, { value, expiresAt: now + 60_000 });
        return value;
    } catch {
        settingsCache.set(workspaceId, { value: disabled, expiresAt: now + 60_000 });
        return disabled;
    }
}

export type GatewayIoLoggingPolicy = WorkspaceIoLoggingSettings & {
    featureEnabled: boolean;
    captureEnabled: boolean;
};

export async function resolveGatewayIoLoggingPolicy(input: {
    workspaceId: string;
    keyId?: string | null;
}): Promise<GatewayIoLoggingPolicy> {
    const bindings = getBindings();
    const [featureEnabled, settings] = await Promise.all([
        isGatewayIoLoggingFeatureEnabled({
            workspaceId: input.workspaceId,
            apiKeyId: input.keyId ?? null,
        }, bindings),
        getWorkspaceIoLoggingSettings(input.workspaceId),
    ]);
    return {
        ...settings,
        featureEnabled,
        captureEnabled: featureEnabled && settings.enabled,
    };
}

async function persistGatewayIoLogMetadata(
    input: GatewayIoLogInput,
    columns: GatewayIoLogColumns,
): Promise<void> {
	await upsertGenerationIoLog({
		workspaceId: input.workspaceId,
		requestId: input.requestId,
		ioLogStatus: columns.io_log_status,
		ioLogStorageProvider: columns.io_log_storage_provider ?? null,
		ioLogBucket: columns.io_log_bucket ?? null,
		ioLogObjectKey: columns.io_log_object_key ?? null,
		ioLogBytes: columns.io_log_bytes ?? null,
		ioLogSha256: columns.io_log_sha256 ?? null,
		ioLogContentType: columns.io_log_content_type ?? null,
		ioLogRetentionUntil: columns.io_log_retention_until ?? null,
		ioLogError: columns.io_log_error ?? null,
	});
}

async function finalizeGatewayIoLog(
    input: GatewayIoLogInput,
    columns: GatewayIoLogColumns,
): Promise<GatewayIoLogColumns> {
    try {
        await persistGatewayIoLogMetadata(input, columns);
        return columns;
    } catch (error) {
        console.error("[io-logging] failed to persist R2 metadata", {
            workspaceId: input.workspaceId,
            requestId: input.requestId,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            ...columns,
            io_log_status: "error",
            io_log_error: "Failed to persist I/O log metadata",
        };
    }
}

export async function persistGatewayIoLog(
    input: GatewayIoLogInput,
    resolvedPolicy?: GatewayIoLoggingPolicy,
): Promise<GatewayIoLogColumns> {
	const bindings = getBindings();
    const policy = resolvedPolicy ?? await resolveGatewayIoLoggingPolicy({
        workspaceId: input.workspaceId,
        keyId: input.keyId ?? null,
    });
    if (!policy.captureEnabled) {
        return finalizeGatewayIoLog(input, { io_log_status: "not_enabled" });
    }

    const bucket = bindings.GATEWAY_IO_LOGS_BUCKET;
    const bucketName = bindings.GATEWAY_IO_LOGS_BUCKET_NAME ?? "gateway-io-logs";
    if (!bucket) {
        return finalizeGatewayIoLog(input, {
            io_log_status: "missing_bucket",
            io_log_storage_provider: "cloudflare_r2",
            io_log_bucket: bucketName,
            io_log_error: "GATEWAY_IO_LOGS_BUCKET binding is not configured",
        });
    }

    const now = new Date();
    const retentionUntil = addDays(now, policy.retentionDays);
    const body = {
        schema_version: 1,
        captured_at: now.toISOString(),
        request_id: input.requestId,
        workspace_id: input.workspaceId,
        app_id: input.appId ?? null,
        key_id: input.keyId ?? null,
        endpoint: input.endpoint ?? null,
        model_id: input.modelId ?? null,
        provider: input.provider ?? null,
        status_code: input.statusCode ?? null,
        success: input.success,
        retention_until: retentionUntil.toISOString(),
        request_payload: sanitizeJsonValue(input.requestPayload),
        gateway_response: sanitizeJsonValue(input.gatewayResponse),
        provider_request: policy.includeProviderPayloads ? sanitizeJsonValue(input.providerRequest) : null,
        provider_response: policy.includeProviderPayloads ? sanitizeJsonValue(input.providerResponse) : null,
        metadata: sanitizeJsonValue(input.metadata),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(body));
    const maxBytes = normalizeMaxBytes(bindings.GATEWAY_IO_LOGGING_MAX_BYTES);
    if (bytes.byteLength > maxBytes) {
        return finalizeGatewayIoLog(input, {
            io_log_status: "too_large",
            io_log_storage_provider: "cloudflare_r2",
            io_log_bucket: bucketName,
            io_log_bytes: bytes.byteLength,
            io_log_content_type: "application/json",
            io_log_retention_until: retentionUntil.toISOString(),
            io_log_error: `I/O log exceeded ${maxBytes} bytes`,
        });
    }

    const hash = await sha256Hex(bytes);
    const objectKey = `workspaces/${input.workspaceId}/${isoDatePath(now)}/${input.requestId}.json`;

    try {
        await bucket.put(objectKey, bytes, {
            httpMetadata: { contentType: "application/json" },
            customMetadata: {
                request_id: input.requestId,
                workspace_id: input.workspaceId,
                retention_until: retentionUntil.toISOString(),
                sha256: hash,
            },
        });
        return finalizeGatewayIoLog(input, {
            io_log_status: "stored",
            io_log_storage_provider: "cloudflare_r2",
            io_log_bucket: bucketName,
            io_log_object_key: objectKey,
            io_log_bytes: bytes.byteLength,
            io_log_sha256: hash,
            io_log_content_type: "application/json",
            io_log_retention_until: retentionUntil.toISOString(),
        });
    } catch (error) {
        return finalizeGatewayIoLog(input, {
            io_log_status: "error",
            io_log_storage_provider: "cloudflare_r2",
            io_log_bucket: bucketName,
            io_log_bytes: bytes.byteLength,
            io_log_sha256: hash,
            io_log_content_type: "application/json",
            io_log_retention_until: retentionUntil.toISOString(),
            io_log_error: error instanceof Error ? error.message : String(error),
        });
    }
}

export async function readGatewayIoLogObject(key: string): Promise<Record<string, unknown> | null> {
    const bucket = getBindings().GATEWAY_IO_LOGS_BUCKET;
    if (!bucket || !key.trim()) return null;
    const object = await bucket.get(key);
    if (!object) return null;
    const text = await object.text();
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
}
