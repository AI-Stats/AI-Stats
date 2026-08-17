import { describe, expect, it, vi } from "vitest";

import { runGatewayTelemetryPipelines } from "./gateway-telemetry";

describe("runGatewayTelemetryPipelines", () => {
	it("delivers the database and Axiom independently", async () => {
		const writeDatabase = vi.fn(async () => undefined);
		const writeOtlp = vi.fn(async () => undefined);
		const writeAxiom = vi.fn(async () => undefined);

		const deliveries = await runGatewayTelemetryPipelines({
			requestId: "req_1",
			workspaceId: "ws_1",
			writeDatabase,
			writeOtlp,
			writeAxiom,
		});

		expect(writeDatabase).toHaveBeenCalledOnce();
		expect(writeOtlp).toHaveBeenCalledOnce();
		expect(writeAxiom).toHaveBeenCalledOnce();
		expect(deliveries).toEqual([
			{ sink: "database", delivered: true, error: null },
			{ sink: "axiom", delivered: true, error: null },
			{ sink: "otlp", delivered: true, error: null },
		]);
	});

	it("does not wait for Broadcast enqueueing before completing request telemetry", async () => {
		let resolveBroadcast!: () => void;
		const broadcastPending = new Promise<void>((resolve) => { resolveBroadcast = resolve; });
		const pipeline = runGatewayTelemetryPipelines({
			requestId: "req_background",
			writeOtlp: () => broadcastPending,
			writeAxiom: async () => undefined,
		});

		await expect(pipeline).resolves.toEqual([
			{ sink: "axiom", delivered: true, error: null },
			{ sink: "otlp", delivered: true, error: null },
		]);
		resolveBroadcast();
	});

	it("still delivers Axiom and reports when the database fails", async () => {
		const writeAxiom = vi.fn(async () => undefined);
		const onDeliveryFailure = vi.fn(async () => undefined);
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

		const deliveries = await runGatewayTelemetryPipelines({
			requestId: "req_2",
			workspaceId: "ws_2",
			writeDatabase: async () => {
				throw new Error("database unavailable");
			},
			writeAxiom,
			onDeliveryFailure,
		});

		expect(writeAxiom).toHaveBeenCalledOnce();
		expect(onDeliveryFailure).toHaveBeenCalledWith({
			sink: "database",
			requestId: "req_2",
			workspaceId: "ws_2",
			error: "database unavailable",
		});
		expect(deliveries[0]).toEqual({
			sink: "database",
			delivered: false,
			error: "database unavailable",
		});

		consoleError.mockRestore();
	});

	it("does not attempt database persistence for testing-mode requests", async () => {
		const writeAxiom = vi.fn(async () => undefined);

		const deliveries = await runGatewayTelemetryPipelines({
			requestId: "req_perf",
			writeDatabase: null,
			writeAxiom,
		});

		expect(deliveries).toEqual([
			{ sink: "axiom", delivered: true, error: null },
		]);
	});

	it("records a non-throwing Axiom delivery failure", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

		const deliveries = await runGatewayTelemetryPipelines({
			requestId: "req_3",
			writeAxiom: async () => false,
		});

		expect(deliveries).toEqual([
			{
				sink: "axiom",
				delivered: false,
				error: "sink reported delivery failure",
			},
		]);

		consoleError.mockRestore();
	});
});
