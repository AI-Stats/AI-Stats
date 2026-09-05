export function isStealthModel(model: unknown): model is string {
    return typeof model === "string" && model.trim().toLowerCase().startsWith("stealth/");
}

export function isStealthRequest(ctx: { model?: unknown; requestedModel?: unknown }): boolean {
    return isStealthModel(ctx.requestedModel) || isStealthModel(ctx.model);
}

type SafeUpstreamErrorArgs = {
    status: number;
    requestId: string;
    model: string;
    endpoint: string;
    keySource?: "gateway" | "byok" | string | null;
    retryAfter?: string | null;
    param?: string | null;
    failedStatuses?: number[] | null;
};

function responsibilityFor(status: number, keySource?: string | null): "user" | "phaseo" | "upstream" {
    if ([400, 413, 422].includes(status)) return "user";
    if ([401, 402, 403].includes(status)) return keySource === "byok" ? "user" : "phaseo";
    if (status === 404) return "phaseo";
    return "upstream";
}

function statusContract(status: number): { code: string; description: string; action: string; retryable: boolean } {
    if (status === 400) return {
        code: "upstream_request_rejected",
        description: "The upstream service rejected the request as invalid.",
        action: "Review the request parameters and try again.",
        retryable: false,
    };
    if (status === 401) return {
        code: "upstream_authentication_failed",
        description: "The upstream service rejected the credentials used for this request.",
        action: "Contact Phaseo support, or verify your provider key if you are using BYOK.",
        retryable: false,
    };
    if (status === 402) return {
        code: "upstream_billing_required",
        description: "The upstream service rejected the request because its billing requirements were not met.",
        action: "Contact Phaseo support, or verify provider billing if you are using BYOK.",
        retryable: false,
    };
    if (status === 403) return {
        code: "upstream_access_denied",
        description: "The upstream service denied access to the requested model or capability.",
        action: "Contact Phaseo support, or verify provider access if you are using BYOK.",
        retryable: false,
    };
    if (status === 404) return {
        code: "upstream_model_unavailable",
        description: "The configured upstream model route was not found.",
        action: "Contact Phaseo support so the model route can be checked.",
        retryable: false,
    };
    if (status === 408 || status === 504) return {
        code: "upstream_timeout",
        description: "The upstream service did not complete the request in time.",
        action: "Retry the request. If it continues to fail, contact Phaseo support with the request ID.",
        retryable: true,
    };
    if (status === 409) return {
        code: "upstream_conflict",
        description: "The upstream service could not process the request because of a temporary conflict.",
        action: "Retry the request.",
        retryable: true,
    };
    if (status === 413) return {
        code: "upstream_request_too_large",
        description: "The upstream service rejected the request because it was too large.",
        action: "Reduce the request size and try again.",
        retryable: false,
    };
    if (status === 422) return {
        code: "upstream_validation_failed",
        description: "The upstream service could not validate one or more request parameters.",
        action: "Review the request parameters and try again.",
        retryable: false,
    };
    if (status === 429) return {
        code: "upstream_rate_limited",
        description: "The upstream service rate limited this request.",
        action: "Retry after the indicated delay, using exponential backoff.",
        retryable: true,
    };
    if (status >= 500) return {
        code: "upstream_service_error",
        description: "The upstream service failed while processing the request.",
        action: "Retry the request. If it continues to fail, contact Phaseo support with the request ID.",
        retryable: true,
    };
    return {
        code: "upstream_error",
        description: "The upstream service could not complete the request.",
        action: "Review the status code and retry if appropriate.",
        retryable: false,
    };
}

export function buildSafeStealthUpstreamError(args: SafeUpstreamErrorArgs): Record<string, unknown> {
    const contract = statusContract(args.status);
    return {
        error: contract.code,
        status_code: args.status,
        error_origin: "upstream",
        responsibility: responsibilityFor(args.status, args.keySource),
        retryable: contract.retryable,
        description: contract.description,
        action: contract.action,
        request_id: args.requestId,
        model: args.model,
        endpoint: args.endpoint,
        ...(args.retryAfter ? { retry_after_seconds: Number(args.retryAfter) } : {}),
        ...(args.param ? { param: args.param } : {}),
        ...(args.failedStatuses?.length ? { failed_statuses: args.failedStatuses } : {}),
    };
}
