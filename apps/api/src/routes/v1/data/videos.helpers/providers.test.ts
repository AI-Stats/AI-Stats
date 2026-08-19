import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { VideoJobMeta, VideoJobRecord } from "@core/video-jobs";
import { installFetchMock, jsonResponse } from "../../../../../tests/helpers/mock-fetch";
import { setupRuntimeFromEnv, teardownTestRuntime } from "../../../../../tests/helpers/runtime";
import { cancelFalTask, decodeFalVideoIdentity, resolveDashscopeTaskId, resolveXAiNativeId } from "./providers";

beforeAll(() => setupRuntimeFromEnv({
	FAL_KEY: "test-fal-key",
	FAL_QUEUE_BASE_URL: "https://queue.fal.test",
}));
afterAll(() => teardownTestRuntime());

function record(provider: string, nativeId: string): VideoJobRecord {
	return { provider, nativeId } as VideoJobRecord;
}

function meta(provider: string, providerTaskId: string): VideoJobMeta {
	return { provider, providerTaskId } as VideoJobMeta;
}

describe("video provider task id resolution", () => {
	it("recognizes all xAI provider aliases", () => {
		for (const provider of ["spacex-ai", "x-ai", "xai"]) {
			expect(resolveXAiNativeId(record(provider, "xai_request_1"), meta(provider, "xai_request_1"), "video_1"))
				.toBe("xai_request_1");
		}
	});

	it("does not treat another provider task id as an Alibaba or xAI id", () => {
		const minimaxRecord = record("minimax", "minimax_task_1");
		const minimaxMeta = meta("minimax", "minimax_task_1");
		expect(resolveDashscopeTaskId(minimaxRecord, minimaxMeta, "video_1")).toBeNull();
		expect(resolveXAiNativeId(minimaxRecord, minimaxMeta, "video_1")).toBeNull();
	});
});

describe("fal queue lifecycle", () => {
	it("decodes the stored endpoint identity and sends the documented cancellation request", async () => {
		const encoded = btoa(JSON.stringify({
			endpoint: "bytedance/seedance-2.0/text-to-video",
			requestId: "fal_request_123",
		})).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
		const nativeId = `falvid_${encoded}`;
		expect(decodeFalVideoIdentity(nativeId)).toEqual({
			endpoint: "bytedance/seedance-2.0/text-to-video",
			requestId: "fal_request_123",
		});

		const mock = installFetchMock([{
			match: (url, init) => url === "https://queue.fal.test/bytedance/seedance-2.0/text-to-video/requests/fal_request_123/cancel" && init?.method === "PUT",
			response: jsonResponse({ status: "CANCELLATION_REQUESTED" }, { status: 202 }),
		}]);
		try {
			const response = await cancelFalTask({
				workspaceId: "team_test",
				requestId: "req_cancel_fal",
			} as any, meta("fal", nativeId), nativeId);
			expect(response.status).toBe(202);
			expect(mock.calls[0]).toMatchObject({
				method: "PUT",
				headers: { Authorization: "Key test-fal-key" },
			});
		} finally {
			mock.restore();
		}
	});
});
