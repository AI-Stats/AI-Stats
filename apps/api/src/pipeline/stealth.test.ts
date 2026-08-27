import { describe, expect, it } from "vitest";
import { buildSafeStealthUpstreamError } from "./stealth";

describe("safe stealth upstream errors", () => {
    it.each([
        [400, "upstream_request_rejected", "user", false],
        [401, "upstream_authentication_failed", "phaseo", false],
        [402, "upstream_billing_required", "phaseo", false],
        [403, "upstream_access_denied", "phaseo", false],
        [404, "upstream_model_unavailable", "phaseo", false],
        [408, "upstream_timeout", "upstream", true],
        [409, "upstream_conflict", "upstream", true],
        [413, "upstream_request_too_large", "user", false],
        [422, "upstream_validation_failed", "user", false],
        [429, "upstream_rate_limited", "upstream", true],
        [500, "upstream_service_error", "upstream", true],
        [502, "upstream_service_error", "upstream", true],
        [503, "upstream_service_error", "upstream", true],
        [504, "upstream_timeout", "upstream", true],
    ])("maps HTTP %i to a descriptive provider-safe contract", (status, code, responsibility, retryable) => {
        const payload = buildSafeStealthUpstreamError({
            status,
            requestId: "req_safe",
            model: "stealth/test-model",
            endpoint: "responses",
            keySource: "gateway",
        });

        expect(payload).toMatchObject({
            error: code,
            status_code: status,
            error_origin: "upstream",
            responsibility,
            retryable,
            request_id: "req_safe",
            model: "stealth/test-model",
            endpoint: "responses",
            description: expect.any(String),
            action: expect.any(String),
        });
        expect(JSON.stringify(payload)).not.toMatch(/openai|anthropic|google|provider_id|upstream_url/i);
    });

    it("assigns managed authentication failures to Phaseo and BYOK failures to the user", () => {
        const base = {
            status: 401,
            requestId: "req_auth",
            model: "stealth/test-model",
            endpoint: "responses",
        };
        expect(buildSafeStealthUpstreamError({ ...base, keySource: "gateway" }).responsibility).toBe("phaseo");
        expect(buildSafeStealthUpstreamError({ ...base, keySource: "byok" }).responsibility).toBe("user");
    });

    it("includes only safe actionable details", () => {
        expect(buildSafeStealthUpstreamError({
            status: 429,
            requestId: "req_rate",
            model: "stealth/test-model",
            endpoint: "responses",
            retryAfter: "30",
            param: "max_tokens",
            failedStatuses: [429],
        })).toMatchObject({
            retry_after_seconds: 30,
            param: "max_tokens",
            failed_statuses: [429],
        });
    });
});
