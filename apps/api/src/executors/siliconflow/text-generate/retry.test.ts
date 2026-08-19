import { describe, expect, it, vi } from "vitest";

const { executeOpenAIWireMock } = vi.hoisted(() => ({
	executeOpenAIWireMock: vi.fn(async () => ({ kind: "completed" })),
}));

vi.mock("@executors/_shared/text-generate/openai-compat", () => ({
	executeOpenAIWire: executeOpenAIWireMock,
}));

import { execute } from "./index";

describe("SiliconFlow transient errors", () => {
	it("allows one adapter retry for documented rate-limit and overload responses", async () => {
		const args = { providerId: "siliconflow" } as any;
		await execute(args);
		expect(executeOpenAIWireMock).toHaveBeenCalledWith(args, { transientRetries: 1 });
	});
});
