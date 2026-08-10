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
	SUPABASE_URL: "https://example.supabase.co",
	SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
	FAL_KEY: "test-fal-key",
	FAL_QUEUE_BASE_URL: "https://queue.fal.test",
}));
afterAll(() => teardownTestRuntime());
beforeEach(() => saveVideoJobMetaMock.mockClear());

function args(inputReferences: any[] = []): ExecutorExecuteArgs {
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
		meta: {},
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
			expect.objectContaining({ provider: "fal", providerTaskId: expect.stringMatching(/^falvid_/) }),
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
});
