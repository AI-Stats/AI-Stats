import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverGatewayOtlpPayload } from "./otlp-export";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("deliverGatewayOtlpPayload", () => {
	it("exports OTLP JSON to the standard traces path", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ partialSuccess: {} }), { status: 200 }),
		);
		vi.stubGlobal("fetch", fetchMock);
		const payload = { resourceSpans: [] };
		const result = await deliverGatewayOtlpPayload(payload, {
			endpoint: "https://collector.example.com",
			headers_json: JSON.stringify({ "x-tenant": "phaseo" }),
		});
		expect(result).toMatchObject({ delivered: true, retryable: false, status: 200 });
		const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
		expect(url.toString()).toBe("https://collector.example.com/v1/traces");
		expect(init).toMatchObject({ method: "POST", body: JSON.stringify(payload) });
		const sentHeaders = new Headers(init.headers);
		expect(sentHeaders.get("content-type")).toBe("application/json");
		expect(sentHeaders.get("x-tenant")).toBe("phaseo");
	});

	it("honours Retry-After for retryable collector responses", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
			new Response("", { status: 503, headers: { "retry-after": "7" } }),
		));
		const result = await deliverGatewayOtlpPayload(
			{ resourceSpans: [] },
			{ endpoint: "https://collector.example.com/v1/traces" },
			2,
		);
		expect(result).toMatchObject({ delivered: false, retryable: true, status: 503, delayMs: 7_000 });
	});

	it("does not retry OTLP partial-success acknowledgements", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
			new Response(JSON.stringify({
				partialSuccess: { rejectedSpans: "2", errorMessage: "invalid attributes" },
			}), { status: 200 }),
		));
		const result = await deliverGatewayOtlpPayload(
			{ resourceSpans: [] },
			{ endpoint: "https://collector.example.com" },
		);
		expect(result).toMatchObject({
			delivered: false,
			retryable: false,
			error: "OTLP partial success rejected 2 spans: invalid attributes",
		});
	});

	it("does not retry invalid or private collector configuration", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const result = await deliverGatewayOtlpPayload(
			{ resourceSpans: [] },
			{ endpoint: "http://127.0.0.1:4318" },
		);
		expect(result).toMatchObject({ delivered: false, retryable: false, status: null });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it.each([
		"http://[::1]:4318",
		"http://[fd00::1]:4318",
		"http://[fe80::1]:4318",
	])("rejects bracketed private IPv6 collector endpoint %s", async (endpoint) => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const result = await deliverGatewayOtlpPayload({ resourceSpans: [] }, { endpoint });

		expect(result).toMatchObject({ delivered: false, retryable: false, status: null });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
