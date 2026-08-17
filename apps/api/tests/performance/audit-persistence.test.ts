import { beforeEach, describe, expect, it, vi } from "vitest";

function percentile(values: number[], p: number): number {
	const sorted = values.slice().sort((a, b) => a - b);
	const index = Math.ceil((p / 100) * sorted.length) - 1;
	return sorted[Math.max(0, index)];
}

const runtime = vi.hoisted(() => ({
	execute: vi.fn(async () => [{ id: "request-row-id", created_at: "2026-08-16T00:00:00.000Z", workspace_id: "00000000-0000-4000-8000-000000000001" }]),
	end: vi.fn(async () => undefined),
}));

vi.mock("@/runtime/env", () => ({ getBindings: () => ({}) }));
vi.mock("@/runtime/db", () => ({
	createDatabase: () => ({ db: { execute: runtime.execute }, client: { end: runtime.end } }),
}));

const { insertGatewayRequest } = await import("@/repositories/audit");

describe("Drizzle audit persistence performance", () => {
	beforeEach(() => {
		runtime.execute.mockClear();
		runtime.end.mockClear();
	});

	it("keeps request audit statement construction under 5ms p95", async () => {
		const baseRow = {
			request_id: "req_perf_audit",
			workspace_id: "00000000-0000-4000-8000-000000000001",
			provider: "openai",
			model: "gpt-5.4-nano",
			endpoint: "responses",
			stream: false,
			success: true,
			generation_ms: 42,
			latency_ms: 21,
			usage: { input_tokens: 10, output_tokens: 5 },
			total_nanos: 12_300_000,
			currency: "USD",
			finish_reason: "stop",
		};

		await insertGatewayRequest(baseRow);
		runtime.execute.mockClear();
		runtime.end.mockClear();

		const samples: number[] = [];
		const iterations = 300;
		for (let index = 0; index < iterations; index += 1) {
			const started = performance.now();
			await insertGatewayRequest({ ...baseRow, request_id: `req_perf_audit_${index}` });
			samples.push(performance.now() - started);
		}

		expect(percentile(samples, 95)).toBeLessThan(5);
		expect(runtime.execute).toHaveBeenCalledTimes(iterations);
		expect(runtime.end).toHaveBeenCalledTimes(iterations);
	});
});
