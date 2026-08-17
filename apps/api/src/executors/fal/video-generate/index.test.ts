import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutorExecuteArgs } from "@executors/types";
import { installFetchMock, jsonResponse } from "../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../tests/helpers/runtime";
import { execute } from "./index";

const saveVideoJobMetaMock = vi.fn(async () => undefined);
vi.mock("@core/video-jobs", () => ({ saveVideoJobMeta: (...args: unknown[]) => saveVideoJobMetaMock(...args) }));
vi.mock("@core/video-reservations", () => ({
	isInsufficientVideoReservationStatus: () => false,
	reserveVideoGenerationCredits: vi.fn(async () => ({ reservationId: null, held: false, amountNanos: 0, status: "skip_zero_cost" })),
}));
vi.mock("@core/wallet-reservations", () => ({ releaseWalletReservation: vi.fn(async () => ({ status: "released" })) }));

beforeAll(() => setupRuntimeFromEnv({
	FAL_KEY: "test-fal-key",
	FAL_QUEUE_BASE_URL: "https://queue.fal.test",
}));
afterAll(() => teardownTestRuntime());
beforeEach(() => saveVideoJobMetaMock.mockClear());

function args(inputReferences: any[] = [], meta: Record<string, unknown> = {}): ExecutorExecuteArgs {
	return {
		ir: { model: "bytedance/seedance-2.0", prompt: "A cinematic fox", duration: 5, inputReferences },
		requestId: "req_fal_video",
		workspaceId: "team_test",
		providerId: "fal",
		endpoint: "video.generation",
		capability: "video.generate",
		providerModelSlug: "bytedance/seedance-2.0",
		byokMeta: [],
		pricingCard: null,
		meta,
	} as ExecutorExecuteArgs;
}

describe("Fal video executor", () => {
	it("submits to the durable text-to-video queue and persists the request id", async () => {
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/bytedance/seedance-2.0/text-to-video"),
			response: jsonResponse({ request_id: "fal_req_123" }),
		}]);
		const result = await execute(args());
		mock.restore();
		expect(result.upstream?.status).toBe(200);
		expect((result as any).ir?.nativeId).toMatch(/^falvid_/);
		expect(saveVideoJobMetaMock).toHaveBeenCalledWith(
			"team_test",
			"req_fal_video",
			expect.objectContaining({
				provider: "fal",
				providerTaskId: expect.stringMatching(/^falvid_/),
				model: "bytedance/seedance-2.0",
			}),
			expect.stringMatching(/^falvid_/),
			"queued",
		);
	});

	it("selects reference-to-video for video inputs", async () => {
		let body: any;
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/bytedance/seedance-2.0/reference-to-video"),
			response: jsonResponse({ request_id: "fal_req_ref" }),
			onRequest: (call) => { body = call.bodyJson; },
		}]);
		await execute(args([{ type: "video", role: "source", url: "https://example.com/source.mp4" }]));
		mock.restore();
		expect(body.video_urls).toEqual(["https://example.com/source.mp4"]);
	});

	it("preserves inline reference data and returns the mapped request when requested", async () => {
		let body: any;
		const mock = installFetchMock([{
			match: (url) => url.endsWith("/bytedance/seedance-2.0/reference-to-video"),
			response: jsonResponse({ request_id: "fal_req_inline" }),
			onRequest: (call) => { body = call.bodyJson; },
		}]);
		const result = await execute(args([{
			type: "video",
			role: "source",
			data: "QUJD",
			mimeType: "video/mp4",
		}], { returnUpstreamRequest: true }));
		mock.restore();

		expect(body.video_urls).toEqual(["data:video/mp4;base64,QUJD"]);
		expect(JSON.parse((result as any).mappedRequest)).toMatchObject({
			video_urls: ["data:video/mp4;base64,QUJD"],
		});
	});

	it("rejects unpriced 480p before Fal submission", async () => {
		const request = args();
		(request.ir as any).resolution = "480p";
		const mock = installFetchMock([]);
		const result = await execute(request);
		mock.restore();

		expect(result.upstream?.status).toBe(400);
		expect(mock.calls).toEqual([]);
	});
});
