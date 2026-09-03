// Purpose: Enforce approximate limits for gateway-managed provider credentials.
// Why: Prevents Phaseo from overrunning upstream request and token quotas while preserving failover.
// How: Loads configuration from Supabase and coordinates fixed-window counters in a Durable Object.

import { resolveCanonicalTokenUsage } from "@core/usage-normalization";
import { getBindings, getSupabaseAdmin } from "@/runtime/env";
import type { PipelineContext } from "@pipeline/before/types";

const CONFIG_CACHE_TTL_MS = 60_000;

export type ProviderRateLimitConfig = {
	providerId: string;
	requestsPerMinute: number | null;
	requestsPerDay: number | null;
	tokensPerMinute: number | null;
	tokensPerDay: number | null;
	headroomBps: number;
};

export type ProviderRateLimitAdmission = {
	allowed: boolean;
	reason: "requests_per_minute" | "requests_per_day" | "tokens_per_minute" | "tokens_per_day" | null;
	retryAfterSeconds: number | null;
};

export type ProviderRateLimitCounters = {
	minuteWindow: number;
	dayWindow: number;
	minuteRequests: number;
	dayRequests: number;
	minuteTokens: number;
	dayTokens: number;
};

const DAY_MS = 86_400_000;

function effectiveTokenLimit(limit: number | null, headroomBps: number): number | null {
	if (limit == null) return null;
	return Math.max(1, Math.floor(limit * (10_000 - headroomBps) / 10_000));
}

export function resolveProviderRateLimitDenial(
	config: ProviderRateLimitConfig,
	counters: ProviderRateLimitCounters,
	nowMs: number,
): ProviderRateLimitAdmission | null {
	const violations: Array<{ reason: NonNullable<ProviderRateLimitAdmission["reason"]>; resetMs: number }> = [];
	const minuteResetMs = (counters.minuteWindow + 1) * 60_000;
	const dayResetMs = (counters.dayWindow + 1) * DAY_MS;
	if (config.requestsPerMinute != null && counters.minuteRequests >= config.requestsPerMinute) {
		violations.push({ reason: "requests_per_minute", resetMs: minuteResetMs });
	}
	if (config.requestsPerDay != null && counters.dayRequests >= config.requestsPerDay) {
		violations.push({ reason: "requests_per_day", resetMs: dayResetMs });
	}
	const tokensPerMinute = effectiveTokenLimit(config.tokensPerMinute, config.headroomBps);
	if (tokensPerMinute != null && counters.minuteTokens >= tokensPerMinute) {
		violations.push({ reason: "tokens_per_minute", resetMs: minuteResetMs });
	}
	const tokensPerDay = effectiveTokenLimit(config.tokensPerDay, config.headroomBps);
	if (tokensPerDay != null && counters.dayTokens >= tokensPerDay) {
		violations.push({ reason: "tokens_per_day", resetMs: dayResetMs });
	}
	if (!violations.length) return null;
	const blocking = violations.sort((left, right) => right.resetMs - left.resetMs)[0];
	return {
		allowed: false,
		reason: blocking.reason,
		retryAfterSeconds: Math.max(1, Math.ceil((blocking.resetMs - nowMs) / 1000)),
	};
}

type CachedConfig = { expiresAt: number; value: ProviderRateLimitConfig | null };
const configCache = new Map<string, CachedConfig>();

function finitePositive(value: unknown): number | null {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseProviderRateLimitConfig(row: Record<string, unknown>): ProviderRateLimitConfig | null {
	if (row.enabled !== true || typeof row.provider_id !== "string" || !row.provider_id.trim()) return null;
	const config = {
		providerId: row.provider_id.trim(),
		requestsPerMinute: finitePositive(row.requests_per_minute),
		requestsPerDay: finitePositive(row.requests_per_day),
		tokensPerMinute: finitePositive(row.tokens_per_minute),
		tokensPerDay: finitePositive(row.tokens_per_day),
		headroomBps: Math.min(5000, Math.max(0, Number(row.headroom_bps) || 0)),
	};
	return config.requestsPerMinute || config.requestsPerDay || config.tokensPerMinute || config.tokensPerDay
		? config
		: null;
}

async function loadConfig(providerId: string): Promise<ProviderRateLimitConfig | null> {
	const now = Date.now();
	const cached = configCache.get(providerId);
	if (cached && cached.expiresAt > now) return cached.value;

	const { data, error } = await getSupabaseAdmin()
		.from("provider_rate_limits")
		.select("provider_id,requests_per_minute,requests_per_day,tokens_per_minute,tokens_per_day,headroom_bps,enabled")
		.eq("provider_id", providerId)
		.maybeSingle();
	if (error) throw new Error(`provider_rate_limit_config_error:${error.message ?? "unknown"}`);
	const value = data ? parseProviderRateLimitConfig(data as Record<string, unknown>) : null;
	configCache.set(providerId, { expiresAt: now + CONFIG_CACHE_TTL_MS, value });
	return value;
}

type ProviderRateLimitStub = {
	admit(config: ProviderRateLimitConfig, nowMs?: number): Promise<ProviderRateLimitAdmission>;
	recordTokens(tokens: number, nowMs?: number): Promise<void>;
};

function getStub(providerId: string): ProviderRateLimitStub | null {
	const namespace = getBindings().PROVIDER_RATE_LIMITS;
	if (!namespace) return null;
	return namespace.getByName(`managed:${providerId}`) as unknown as ProviderRateLimitStub;
}

export async function admitManagedProvider(providerId: string): Promise<ProviderRateLimitAdmission> {
	const fallback: ProviderRateLimitAdmission = { allowed: true, reason: null, retryAfterSeconds: null };
	try {
		const config = await loadConfig(providerId);
		if (!config) return fallback;
		const stub = getStub(providerId);
		return stub ? await stub.admit(config) : fallback;
	} catch (error) {
		console.error("[gateway] provider rate-limit admission failed open", {
			provider: providerId,
			error: error instanceof Error ? error.message : String(error),
		});
		return fallback;
	}
}

export async function recordManagedProviderTokensOnce(args: {
	ctx: PipelineContext;
	providerId: string;
	keySource: "gateway" | "byok" | undefined;
	usage: unknown;
}): Promise<void> {
	if (args.keySource === "byok" || args.ctx.testingMode) return;
	const meta = args.ctx.meta as Record<string, unknown>;
	if (meta.__providerRateLimitTokensRecorded === true) return;
	const tokens = resolveCanonicalTokenUsage(args.usage).totalTokens;
	if (tokens <= 0) return;
	meta.__providerRateLimitTokensRecorded = true;
	try {
		const config = await loadConfig(args.providerId);
		if (!config || (!config.tokensPerMinute && !config.tokensPerDay)) return;
		await getStub(args.providerId)?.recordTokens(tokens);
	} catch (error) {
		console.error("[gateway] provider token accounting failed", {
			provider: args.providerId,
			requestId: args.ctx.requestId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export function clearProviderRateLimitConfigCacheForTests(): void {
	configCache.clear();
}
