import { describe, expect, it } from "vitest";
import type { VideoJobMeta, VideoJobRecord } from "@core/video-jobs";
import { resolveDashscopeTaskId, resolveXAiNativeId } from "./providers";

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
