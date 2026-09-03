// Purpose: Coordinate fixed-window provider quota counters globally.
// Why: Native Workers rate-limit counters are location-local and cannot account for completed token usage.
// How: Stores one durable counter row per managed provider credential scope.

import { DurableObject } from "cloudflare:workers";
import type { GatewayBindings } from "@/runtime/env.types";
import type { ProviderRateLimitAdmission, ProviderRateLimitConfig } from "@core/provider-rate-limits";

type CounterRow = {
	id: number;
	minute_window: number;
	day_window: number;
	minute_requests: number;
	day_requests: number;
	minute_tokens: number;
	day_tokens: number;
};

const DAY_MS = 86_400_000;

function effectiveLimit(limit: number | null, headroomBps: number): number | null {
	if (limit == null) return null;
	return Math.max(1, Math.floor(limit * (10_000 - headroomBps) / 10_000));
}
export class ProviderRateLimitDurableObject extends DurableObject<GatewayBindings> {
	constructor(ctx: DurableObjectState, env: GatewayBindings) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.ctx.storage.sql.exec(`
				CREATE TABLE IF NOT EXISTS counters (
					id INTEGER PRIMARY KEY CHECK (id = 1),
					minute_window INTEGER NOT NULL,
					day_window INTEGER NOT NULL,
					minute_requests INTEGER NOT NULL,
					day_requests INTEGER NOT NULL,
					minute_tokens INTEGER NOT NULL,
					day_tokens INTEGER NOT NULL
				)
			`);
		});
	}

	private current(nowMs: number): CounterRow {
		const minuteWindow = Math.floor(nowMs / 60_000);
		const dayWindow = Math.floor(nowMs / DAY_MS);
		let row = this.ctx.storage.sql.exec<CounterRow>("SELECT * FROM counters WHERE id = 1").toArray()[0];
		if (!row) {
			this.ctx.storage.sql.exec(
				"INSERT INTO counters VALUES (1, ?, ?, 0, 0, 0, 0)",
				minuteWindow,
				dayWindow,
			);
			row = { id: 1, minute_window: minuteWindow, day_window: dayWindow, minute_requests: 0, day_requests: 0, minute_tokens: 0, day_tokens: 0 };
		}
		if (row.minute_window !== minuteWindow) {
			row.minute_window = minuteWindow;
			row.minute_requests = 0;
			row.minute_tokens = 0;
		}
		if (row.day_window !== dayWindow) {
			row.day_window = dayWindow;
			row.day_requests = 0;
			row.day_tokens = 0;
		}
		return row;
	}

	private persist(row: CounterRow): void {
		this.ctx.storage.sql.exec(
			`UPDATE counters SET minute_window = ?, day_window = ?, minute_requests = ?,
			 day_requests = ?, minute_tokens = ?, day_tokens = ? WHERE id = 1`,
			row.minute_window,
			row.day_window,
			row.minute_requests,
			row.day_requests,
			row.minute_tokens,
			row.day_tokens,
		);
	}

	async admit(config: ProviderRateLimitConfig, nowMs = Date.now()): Promise<ProviderRateLimitAdmission> {
		const row = this.current(nowMs);
		const limits = {
			requests_per_minute: config.requestsPerMinute,
			requests_per_day: config.requestsPerDay,
			tokens_per_minute: effectiveLimit(config.tokensPerMinute, config.headroomBps),
			tokens_per_day: effectiveLimit(config.tokensPerDay, config.headroomBps),
		};
		let reason: ProviderRateLimitAdmission["reason"] = null;
		if (limits.requests_per_minute != null && row.minute_requests >= limits.requests_per_minute) reason = "requests_per_minute";
		else if (limits.requests_per_day != null && row.day_requests >= limits.requests_per_day) reason = "requests_per_day";
		else if (limits.tokens_per_minute != null && row.minute_tokens >= limits.tokens_per_minute) reason = "tokens_per_minute";
		else if (limits.tokens_per_day != null && row.day_tokens >= limits.tokens_per_day) reason = "tokens_per_day";

		if (reason) {
			const resetMs = reason.endsWith("minute")
				? (row.minute_window + 1) * 60_000
				: (row.day_window + 1) * DAY_MS;
			return { allowed: false, reason, retryAfterSeconds: Math.max(1, Math.ceil((resetMs - nowMs) / 1000)) };
		}

		row.minute_requests += 1;
		row.day_requests += 1;
		this.persist(row);
		return { allowed: true, reason: null, retryAfterSeconds: null };
	}

	async recordTokens(tokens: number, nowMs = Date.now()): Promise<void> {
		if (!Number.isSafeInteger(tokens) || tokens <= 0) return;
		const row = this.current(nowMs);
		row.minute_tokens += tokens;
		row.day_tokens += tokens;
		this.persist(row);
	}
}
