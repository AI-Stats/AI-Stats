// Purpose: Coordinate fixed-window provider quota counters globally.
// Why: Native Workers rate-limit counters are location-local and cannot account for completed token usage.
// How: Stores one durable counter row per managed provider credential scope.

import { DurableObject } from "cloudflare:workers";
import type { GatewayBindings } from "@/runtime/env.types";
import {
	resolveProviderRateLimitDenial,
	type ProviderRateLimitAdmission,
	type ProviderRateLimitConfig,
} from "@core/provider-rate-limits";

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
		const denial = resolveProviderRateLimitDenial(config, {
			minuteWindow: row.minute_window,
			dayWindow: row.day_window,
			minuteRequests: row.minute_requests,
			dayRequests: row.day_requests,
			minuteTokens: row.minute_tokens,
			dayTokens: row.day_tokens,
		}, nowMs);
		if (denial) return denial;

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
